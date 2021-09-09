import { HealthCheck } from '@godaddy/terminus';
import { readFileSync } from 'fs';
import { Connection, ConnectionOptions, createConnection } from 'typeorm';

import { Replica } from '../../replica/DAL/typeorm/replica';
import { DbConfig } from '../interfaces';
import { promiseTimeout } from '../utils/promiseTimeout';

let connectionSingleton: Connection | undefined;

const DB_TIMEOUT = 5000;

export const DB_ENTITIES = [Replica];

export const createConnectionOptions = (dbConfig: DbConfig): ConnectionOptions => {
  const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
  if (enableSslAuth && connectionOptions.type === 'postgres') {
    connectionOptions.password = undefined;
    connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
  }
  return { entities: [...DB_ENTITIES, '**/DAL/typeorm/*.js'], ...connectionOptions };
};

export const initConnection = async (dbConfig: DbConfig): Promise<Connection> => {
  if (connectionSingleton === undefined || !connectionSingleton.isConnected) {
    connectionSingleton = await createConnection(createConnectionOptions(dbConfig));
  }
  return connectionSingleton;
};

export const getDbHealthCheckFunction = (connection: Connection): HealthCheck => {
  return async (): Promise<void> => {
    const check = connection.query('SELECT 1').then(() => {
      return;
    });
    return promiseTimeout<void>(DB_TIMEOUT, check);
  };
};
