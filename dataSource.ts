import { DataSource } from 'typeorm';
import config from 'config';
import { DbConfig } from './src/common/interfaces';
import { createConnectionOptions } from './src/common/db';

const dataSourceOptions = config.get<DbConfig>('db');

export const appDataSource = new DataSource({
  ...createConnectionOptions(dataSourceOptions),
  entities: ['src/**/DAL/typeorm/*.ts'],
  migrationsTableName: 'migrations_table',
  migrations: ['db/migrations/*.ts'],
});
