import { vectorCommonV1Type } from '@map-colonies/schemas';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export type DbCommonConfig = Pick<vectorCommonV1Type, 'db'>['db'];

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IObjectStorageConfig {
  protocol: string;
  host: string;
  projectId?: string;
  port: string;
}
