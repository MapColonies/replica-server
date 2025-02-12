import { DataSource } from 'typeorm';
import { getConfig } from './src/common/config';
import { convertDBConfigToTypeorm } from './src/common/utils/configModifier';
import { createConnectionOptions } from './src/common/db';

const config = getConfig();
const dataSourceOptions = config.get('db');

export const appDataSource = new DataSource({
  ...createConnectionOptions(convertDBConfigToTypeorm(dataSourceOptions)),
  entities: ['src/**/DAL/typeorm/*.ts'],
  migrationsTableName: 'migrations_table',
  migrations: ['db/migrations/*.ts'],
});
