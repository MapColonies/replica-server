import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { DataSource } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instancePerContainerCachingFactory } from 'tsyringe';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { Services } from './common/constants';
import { DATA_SOURCE_PROVIDER } from './common/db';
import { tracing } from './common/tracing';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layerRouterFactory, LAYER_ROUTER_SYMBOL } from './layer/routes/layerRouter';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL, replicaRepositoryFactory } from './replica/DAL/typeorm/replicaRepository';
import { IObjectStorageConfig } from './common/interfaces';
import { dataSourceFactory, getDbHealthCheckFunction } from './common/db';
import { fileRepositoryFactory, FILE_CUSTOM_REPOSITORY_SYMBOL } from './replica/DAL/typeorm/fileRepository';
import { layerRepoFactory, LAYER_REPOSITORY_SYMBOL } from './layer/DAL/typeorm/layerRepository';
import { ShutdownHandler } from './common/shutdownHandler';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const shutdownHandler = new ShutdownHandler();
  try {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    // @ts-expect-error the signature is wrong
    const logger = jsLogger({ ...loggerConfig, hooks: { logMethod } });

    const metrics = new Metrics('app');
    const meter = metrics.start();

    const objectStorageConfig = config.get<IObjectStorageConfig>('objectStorage');

    tracing.start();
    const tracer = trace.getTracer('app');

    const dependencies: InjectionObject<unknown>[] = [
      { token: Services.CONFIG, provider: { useValue: config } },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: { useFactory: instancePerContainerCachingFactory(dataSourceFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DATA_SOURCE_PROVIDER);
          shutdownHandler.addFunction(dataSource.destroy.bind(dataSource));
          await dataSource.initialize();
        },
      },
      { token: Services.LOGGER, provider: { useValue: logger } },
      { token: Services.TRACER, provider: { useValue: tracer } },
      { token: Services.METER, provider: { useValue: meter } },
      { token: Services.OBJECT_STORAGE, provider: { useValue: objectStorageConfig } },
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
              await Promise.all([tracing.stop(), metrics.stop()]);
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
