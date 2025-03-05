import { vectorCommonV1Type } from '@map-colonies/schemas';

export type DbCommonConfig = Pick<vectorCommonV1Type, 'db'>['db'];

export type IObjectStorageConfig = Pick<vectorCommonV1Type, 'objectStorage'>['objectStorage'];
