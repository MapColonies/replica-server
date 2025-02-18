import { vectorCommonV1Type } from '@map-colonies/schemas';
import { DataSourceOptions } from 'typeorm';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export type DbConfig = {
  enableSslAuth: boolean;
  sslPaths: { ca: string; cert: string; key: string };
} & DataSourceOptions;

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
