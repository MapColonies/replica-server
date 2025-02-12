import { DataSource, Entity } from 'typeorm';
import { getConfig, initConfig } from './src/common/config';
import { convertDBConfigToTypeorm } from './src/common/utils/configModifier';
import { createConnectionOptions } from './src/common/db';

// async function getAppDataSource(): Promise<DataSource>{
//   await initConfig(true);
//   const config = getConfig();
//   const dataSourceOptions = config.get('db');

//   return new DataSource({
//     ...createConnectionOptions(convertDBConfigToTypeorm(dataSourceOptions)),
//     entities: ['src/**/DAL/typeorm/*.ts'],
//     migrationsTableName: 'migrations_table',
//     migrations: ['db/migrations/*.ts'],
//   });
  
// }

//export const appDataSource : Promise<DataSource> = getAppDataSource();

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