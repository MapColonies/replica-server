import { hostname } from 'os';
import { readFileSync } from 'fs';
import { HealthCheck } from '@godaddy/terminus';
import { DataSourceOptions, DataSource } from 'typeorm';
import { DependencyContainer, FactoryFunction } from 'tsyringe';
import { Layer } from '../../layer/DAL/typeorm/layer';
import { File } from '../../replica/DAL/typeorm/file';
import { Replica } from '../../replica/DAL/typeorm/replica';
import { DbConfig, IConfig } from '../interfaces';
import { promiseTimeout } from '../utils/promiseTimeout';
import { Services } from '../constants';

let connectionSingleton: DataSource | undefined;

const DB_TIMEOUT = 5000;

export const DB_ENTITIES = [Replica, File, Layer];

export const DATA_SOURCE_PROVIDER = Symbol('dataSourceProvider');

export const createConnectionOptions = (dbConfig: DbConfig): DataSourceOptions => {
  const { enableSslAuth, sslPaths, ...dataSourceOptions } = dbConfig;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  dataSourceOptions.extra = { application_name: `${hostname()}-${process.env.NODE_ENV ?? 'unknown_env'}` };
  if (enableSslAuth && dataSourceOptions.type === 'postgres') {
    dataSourceOptions.password = undefined;
    dataSourceOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
  }
  return { entities: [...DB_ENTITIES, '**/DAL/typeorm/*.js'], ...dataSourceOptions };
};

export const initConnection = async (dbConfig: DbConfig): Promise<DataSource> => {
  if (connectionSingleton === undefined || !connectionSingleton.isInitialized) {
    connectionSingleton = new DataSource(createConnectionOptions(dbConfig));
    await connectionSingleton.initialize();
  }
  return connectionSingleton;
};

export const getDbHealthCheckFunction = (connection: DataSource): HealthCheck => {
  return async (): Promise<void> => {
    const check = connection.query('SELECT 1').then(() => {
      return;
    });
    return promiseTimeout<void>(DB_TIMEOUT, check);
  };
};

export const dataSourceFactory: FactoryFunction<DataSource> = (container: DependencyContainer): DataSource => {
  const config = container.resolve<IConfig>(Services.CONFIG);
  const dbConfig = config.get<DbConfig>('db');
  const dataSourceOptions = createConnectionOptions(dbConfig);
  return new DataSource(dataSourceOptions);
};
