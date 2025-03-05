import { getOtelMixin } from '@map-colonies/telemetry';
import { DataSource } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instancePerContainerCachingFactory } from 'tsyringe';
import jsLogger, { Logger } from '@map-colonies/js-logger';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { HEALTHCHECK, ON_SIGNAL, SERVICES, SERVICE_NAME } from './common/constants';
import { DATA_SOURCE_PROVIDER } from './common/db';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layerRouterFactory, LAYER_ROUTER_SYMBOL } from './layer/routes/layerRouter';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL, replicaRepositoryFactory } from './replica/DAL/typeorm/replicaRepository';
import { dataSourceFactory, getDbHealthCheckFunction } from './common/db';
import { fileRepositoryFactory, FILE_CUSTOM_REPOSITORY_SYMBOL } from './replica/DAL/typeorm/fileRepository';
import { layerRepoFactory, LAYER_REPOSITORY_SYMBOL } from './layer/DAL/typeorm/layerRepository';
import { getTracing } from './common/tracing';
import { ConfigType, getConfig } from './common/config';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const cleanupRegistry = new CleanupRegistry();

  try {
    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: getConfig() } },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: { useFactory: instancePerContainerCachingFactory(dataSourceFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DATA_SOURCE_PROVIDER);
          cleanupRegistry.register({ id: DATA_SOURCE_PROVIDER, func: dataSource.destroy.bind(dataSource) });
          await dataSource.initialize();
        },
      },
      {
        token: SERVICES.CLEANUP_REGISTRY,
        provider: { useValue: cleanupRegistry },
        afterAllInjectionHook(container): void {
          const logger = container.resolve<Logger>(SERVICES.LOGGER);
          const cleanupRegistryLogger = logger.child({ subComponent: 'cleanupRegistry' });

          cleanupRegistry.on('itemFailed', (id, error, msg) => cleanupRegistryLogger.error({ msg, itemId: id, err: error }));
          cleanupRegistry.on('itemCompleted', (id) => cleanupRegistryLogger.info({ itemId: id, msg: 'cleanup finished for item' }));
          cleanupRegistry.on('finished', (status) => cleanupRegistryLogger.info({ msg: `cleanup registry finished cleanup`, status }));
        },
      },
      {
        token: SERVICES.LOGGER,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            const loggerConfig = config.get('telemetry.logger');
            const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin() });
            return logger;
          }),
        },
      },
      {
        token: SERVICES.TRACER,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const cleanupRegistry = container.resolve<CleanupRegistry>(SERVICES.CLEANUP_REGISTRY);
            cleanupRegistry.register({ id: SERVICES.TRACER, func: getTracing().stop.bind(getTracing()) });
            const tracer = trace.getTracer(SERVICE_NAME);
            return tracer;
          }),
        },
      },
      {
        token: SERVICES.METRICS,
        provider: {
          useValue: instancePerContainerCachingFactory((container) => {
            const metricsRegistry = new Registry();
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            config.initializeMetrics(metricsRegistry);
            return metricsRegistry;
          }),
        },
      },
      {
        token: SERVICES.OBJECT_STORAGE,
        provider: {
          useValue: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>('config');
            return config.get('objectStorage');
          }),
        },
      },
      { token: REPLICA_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: replicaRepositoryFactory } },
      { token: FILE_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: fileRepositoryFactory } },
      { token: LAYER_REPOSITORY_SYMBOL, provider: { useFactory: layerRepoFactory } },
      { token: REPLICA_ROUTER_SYMBOL, provider: { useFactory: replicaRouterFactory } },
      { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
      {
        token: HEALTHCHECK,
        provider: { useFactory: (container): unknown => getDbHealthCheckFunction(container.resolve<DataSource>(DATA_SOURCE_PROVIDER)) },
      },
      {
        token: ON_SIGNAL,
        provider: {
          useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
        },
      },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await cleanupRegistry.trigger();
    throw error;
  }
};
