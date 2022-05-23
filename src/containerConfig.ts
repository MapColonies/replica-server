import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { DataSource } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { Services } from './common/constants';
import { tracing } from './common/tracing';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layerRouterFactory, LAYER_ROUTER_SYMBOL } from './layer/routes/layerRouter';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL, replicaRepositoryFactory } from './replica/DAL/typeorm/replicaRepository';
import { DbConfig, IObjectStorageConfig } from './common/interfaces';
import { getDbHealthCheckFunction, initConnection } from './common/db';
import { fileRepositoryFactory, FILE_CUSTOM_REPOSITORY_SYMBOL } from './replica/DAL/typeorm/fileRepository';
import { layerRepoFactory, LAYER_REPOSITORY_SYMBOL } from './layer/DAL/typeorm/layerRepository';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const dataSourceOptions = config.get<DbConfig>('db');
  const connection = await initConnection(dataSourceOptions);

  const metrics = new Metrics('app');
  const meter = metrics.start();

  const objectStorageConfig = config.get<IObjectStorageConfig>('objectStorage');

  tracing.start();
  const tracer = trace.getTracer('app');

  const dependencies: InjectionObject<unknown>[] = [
    { token: Services.CONFIG, provider: { useValue: config } },
    { token: Services.LOGGER, provider: { useValue: logger } },
    { token: Services.TRACER, provider: { useValue: tracer } },
    { token: Services.METER, provider: { useValue: meter } },
    { token: Services.OBJECT_STORAGE, provider: { useValue: objectStorageConfig } },
    {
      token: DataSource,
      provider: {
        useValue: connection,
      },
    },
    { token: REPLICA_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: replicaRepositoryFactory } },
    { token: FILE_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: fileRepositoryFactory } },
    { token: LAYER_REPOSITORY_SYMBOL, provider: { useFactory: layerRepoFactory } },
    { token: REPLICA_ROUTER_SYMBOL, provider: { useFactory: replicaRouterFactory } },
    { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
    { token: 'healthcheck', provider: { useFactory: (container): unknown => getDbHealthCheckFunction(container.resolve<DataSource>(DataSource)) } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop(), metrics.stop(), connection.destroy()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
