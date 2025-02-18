import { hostname } from 'os';
import { readFileSync } from 'fs';
import { TlsOptions } from 'tls';
import { HealthCheck } from '@godaddy/terminus';
import { DataSourceOptions, DataSource } from 'typeorm';
import { FactoryFunction } from 'tsyringe';
import { Layer } from '../../layer/DAL/typeorm/layer';
import { File } from '../../replica/DAL/typeorm/file';
import { Replica } from '../../replica/DAL/typeorm/replica';
import { DbCommonConfig } from '../interfaces';
import { promiseTimeout } from '../utils/promiseTimeout';
import { getConfig } from '../config';

let connectionSingleton: DataSource | undefined;

const DB_TIMEOUT = 5000;

export const DB_ENTITIES = [Replica, File, Layer];

export const DATA_SOURCE_PROVIDER = Symbol('dataSourceProvider');

/**
 * A helper function that creates the typeorm DataSource options to use for creating a new DataSource.
 * Handles SSL and registration of all required entities and migrations.
 * @param dbConfig The typeorm postgres configuration with added SSL options.
 * @returns Options object ready to use with typeorm.
 */
export const createConnectionOptions = (dbConfig: DbCommonConfig): DataSourceOptions => {
  let ssl: TlsOptions | undefined = undefined;
  const { ssl: inputSsl, ...dataSourceOptions } = dbConfig;
  if (inputSsl.enabled) {
    ssl = { key: readFileSync(inputSsl.key), cert: readFileSync(inputSsl.cert), ca: readFileSync(inputSsl.ca) };
  }
  return {
    ...dataSourceOptions,
    type: 'postgres',
    entities: [...DB_ENTITIES, '**/models/*.js'],
    ssl,
    applicationName: `${hostname()}-${process.env.NODE_ENV ?? 'unknown_env'}`,
  };
};

export const initConnection = async (dbConfig: DbCommonConfig): Promise<DataSource> => {
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

export const dataSourceFactory: FactoryFunction<DataSource> = (): DataSource => {
  const config = getConfig();
  const dbConfig = config.get('db');

  const dataSourceOptions = createConnectionOptions(dbConfig);
  return new DataSource(dataSourceOptions);
};
