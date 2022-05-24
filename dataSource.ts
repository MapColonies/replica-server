import { DataSource } from 'typeorm';
import config from 'config';
import { DbConfig } from './src/common/interfaces';
import { createConnectionOptions } from './src/common/db';

const dataSourceOptions = config.get<DbConfig>('db');

// eslint-disable-next-line @typescript-eslint/naming-convention
export const AppDataSource = new DataSource({
  ...createConnectionOptions(dataSourceOptions),
  entities: ['src/**/DAL/typeorm/*.ts'],
  migrationsTableName: 'migrations_table',
  migrations: ['db/migrations/*.ts'],
});
