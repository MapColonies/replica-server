import { DataSource, Entity } from 'typeorm';
import { getConfig, initConfig } from './src/common/config';
import { convertDBConfigToTypeorm } from './src/common/utils/configModifier';
import { createConnectionOptions } from './src/common/db';

const dataSourceFactory = async (): Promise<DataSource> => {
  await initConfig(true);
  const config = getConfig();
  const connectionOptions = convertDBConfigToTypeorm(config.get('db'));

  const appDataSource = new DataSource({
    ...createConnectionOptions(connectionOptions),
    entities: [Entity, 'src/entity/models/*.ts'],
    migrationsTableName: 'custom_migration_table',
    migrations: ['db/migration/*.ts'],
  });

  return appDataSource;
};

export default dataSourceFactory();