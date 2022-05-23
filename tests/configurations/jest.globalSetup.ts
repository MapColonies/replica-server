import config from 'config';
import { initConnection } from '../../src/common/db/index';
import { DbConfig } from '../../src/common/interfaces';

export default async (): Promise<void> => {
  const dataSourceOptions = config.get<DbConfig>('db');
  const connection = await initConnection({ ...dataSourceOptions });
  await connection.synchronize();
};
