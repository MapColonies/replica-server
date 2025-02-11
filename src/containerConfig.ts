import { getOtelMixin, Metrics } from '@map-colonies/telemetry';
import { DataSource } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instancePerContainerCachingFactory } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { DATA_SOURCE_PROVIDER } from './common/db';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layerRouterFactory, LAYER_ROUTER_SYMBOL } from './layer/routes/layerRouter';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL, replicaRepositoryFactory } from './replica/DAL/typeorm/replicaRepository';
import { dataSourceFactory, getDbHealthCheckFunction } from './common/db';
import { fileRepositoryFactory, FILE_CUSTOM_REPOSITORY_SYMBOL } from './replica/DAL/typeorm/fileRepository';
import { layerRepoFactory, LAYER_REPOSITORY_SYMBOL } from './layer/DAL/typeorm/layerRepository';
import { ShutdownHandler } from './common/shutdownHandler';
import { getTracing } from './common/tracing';
import { getConfig } from './common/config';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const shutdownHandler = new ShutdownHandler();
  try {
    const configInstance = getConfig();
    configInstance.getAll().telemetry

    const loggerConfig = configInstance.get('telemetry.logger');
    const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin() });

    const otelMetrics = new Metrics();
    otelMetrics.start();

    const objectStorageConfig = configInstance.get('objectStorage');

    const tracer = trace.getTracer(SERVICE_NAME);
    const metricsRegistry = new Registry();

    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: { useFactory: instancePerContainerCachingFactory(dataSourceFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DATA_SOURCE_PROVIDER);
          shutdownHandler.addFunction(dataSource.destroy.bind(dataSource));
          await dataSource.initialize();
        },
      },
      { token: SERVICES.LOGGER, provider: { useValue: logger } },
      { token: SERVICES.TRACER, provider: { useValue: tracer } },
      { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
      { token: SERVICES.OBJECT_STORAGE, provider: { useValue: objectStorageConfig } },
      { token: REPLICA_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: replicaRepositoryFactory } },
      { token: FILE_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: fileRepositoryFactory } },
      { token: LAYER_REPOSITORY_SYMBOL, provider: { useFactory: layerRepoFactory } },
      { token: REPLICA_ROUTER_SYMBOL, provider: { useFactory: replicaRouterFactory } },
      { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
      {
        token: 'healthcheck',
        provider: { useFactory: (container): unknown => getDbHealthCheckFunction(container.resolve<DataSource>(DATA_SOURCE_PROVIDER)) },
      },
      {
        token: 'onSignal',
        provider: {
          useValue: {
            useValue: async (): Promise<void> => {
              await Promise.all([getTracing().stop(), otelMetrics.stop()]);
            },
          },
        },
      },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await shutdownHandler.onShutdown();
    throw error;
  }
};
