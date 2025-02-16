import { DataSource } from 'typeorm';
import { getConfig, initConfig } from './src/common/config';
import { createConnectionOptions } from './src/common/db';

const dataSourceFactory = async (): Promise<DataSource> => {
  await initConfig(true);
  const config = getConfig();
  const connectionOptions = config.get('db');
  const appDataSource = new DataSource({
    ...createConnectionOptions(connectionOptions),
    entities: ['src/entity/models/*.ts'],
    migrationsTableName: 'custom_migration_table',
    migrations: ['db/migrations/*.ts'],
  });

  return appDataSource;
};

export default dataSourceFactory();
