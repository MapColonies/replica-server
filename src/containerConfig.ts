import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { Connection } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { Services } from './common/constants';
import { tracing } from './common/tracing';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { anotherResourceRouterFactory, ANOTHER_RESOURECE_ROUTER_SYMBOL } from './anotherResource/routes/anotherResourceRouter';
import { IReplicaRepository, REPLICA_REPOSITORY_SYMBOL } from './replica/DAL/IReplicaRepository';
import { ReplicaRepository } from './replica/DAL/typeorm/replicaRepository';
import { DbConfig } from './common/interfaces';
import { getDbHealthCheckFunction, initConnection } from './common/db';
import { FILE_REPOSITORY_SYMBOL, IFileRepository } from './replica/DAL/IFileRepository';
import { FileRepository } from './replica/DAL/typeorm/fileRepository';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const connectionOptions = config.get<DbConfig>('db');
  const connection = await initConnection(connectionOptions);

  const metrics = new Metrics('app');
  const meter = metrics.start();

  tracing.start();
  const tracer = trace.getTracer('app');

  const dependencies: InjectionObject<unknown>[] = [
    { token: Services.CONFIG, provider: { useValue: config } },
    { token: Services.LOGGER, provider: { useValue: logger } },
    { token: Services.TRACER, provider: { useValue: tracer } },
    { token: Services.METER, provider: { useValue: meter } },
    {
      token: Connection,
      provider: {
        useValue: connection,
      },
    },
    {
      token: REPLICA_REPOSITORY_SYMBOL,
      provider: {
        useFactory: (container): IReplicaRepository => {
          return container.resolve<Connection>(Connection).getCustomRepository(ReplicaRepository);
        },
      },
    },
    {
      token: FILE_REPOSITORY_SYMBOL,
      provider: {
        useFactory: (container): IFileRepository => {
          return container.resolve<Connection>(Connection).getCustomRepository(FileRepository);
        },
      },
    },
    { token: REPLICA_ROUTER_SYMBOL, provider: { useFactory: replicaRouterFactory } },
    { token: ANOTHER_RESOURECE_ROUTER_SYMBOL, provider: { useFactory: anotherResourceRouterFactory } },
    { token: 'healthcheck', provider: { useFactory: (container): unknown => getDbHealthCheckFunction(container.resolve<Connection>(Connection)) } },
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

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
