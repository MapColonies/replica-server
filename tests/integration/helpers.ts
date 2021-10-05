import faker from 'faker';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { snakeCase } from 'snake-case';
import { SnakeCasedProperties } from 'type-fest';
import { Services } from '../../src/common/constants';
import { IObjectStorageConfig } from '../../src/common/interfaces';
import { SortFilter } from '../../src/common/types';
import { RegisterOptions } from '../../src/containerConfig';
import { ReplicaResponse } from '../../src/replica/models/replica';
import { StringifiedReplica } from './replica/helpers/generators';

export const DEFAULT_SORT = 'desc';

export const BOTTOM_FROM = faker.date.past();

export const TOP_TO = faker.date.future();

export type StringifiedReplicaResponse = Omit<ReplicaResponse, 'timestamp'> & { timestamp: string };

export const getBaseRegisterOptions = (): Required<RegisterOptions> => {
  return {
    override: [
      { token: Services.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      { token: Services.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    ],
    useChild: true,
  };
};

export const getMockObjectStorageConfig = (includeProjectId = false): IObjectStorageConfig => {
  const objectStorageConfig: IObjectStorageConfig = { protocol: 'http', host: 'some_storage_host', port: '9000' };
  if (includeProjectId) {
    objectStorageConfig.projectId = 'some_project_id';
  }
  return objectStorageConfig;
};

export const convertReplicaToResponse = (replica: StringifiedReplica, fileIds?: string[], includeProjectId = false): StringifiedReplicaResponse => {
  const urls = fileIds !== undefined ? convertReplicaToUrls(replica, fileIds, includeProjectId) : [];
  const { replicaId, bucketName, ...restOfMetadata } = replica;
  return { ...restOfMetadata, urls };
};

export const convertReplicaToUrls = (replica: StringifiedReplica, fileIds: string[], includeProjectId = false): string[] => {
  const { protocol, host, projectId, port } = getMockObjectStorageConfig(includeProjectId);
  const { bucketName, layerId, geometryType } = replica;

  let bucketOrProjectIdWithBucket = bucketName;
  if (includeProjectId && projectId !== undefined) {
    bucketOrProjectIdWithBucket = `${projectId}:${bucketName}`;
  }
  return fileIds.map((fileId) => `${protocol}://${host}:${port}/${bucketOrProjectIdWithBucket}/${layerId}/${geometryType}/${fileId}`);
};

export const convertObjectToSnakeCase = <T extends Record<string, unknown>>(obj: T): SnakeCasedProperties<T> => {
  const keyValues = Object.entries(obj);

  let snakeCasedObject = {};

  for (const [key, value] of keyValues) {
    snakeCasedObject = { ...snakeCasedObject, [snakeCase(key)]: value };
  }

  return snakeCasedObject as SnakeCasedProperties<T>;
};

export const sortByOrderFilter = <T extends { timestamp: string | Date }>(data: T[], sort: SortFilter = DEFAULT_SORT): T[] => {
  return data.sort((itemA, itemB) => {
    const dateA = +new Date(itemA.timestamp);
    const dateB = +new Date(itemB.timestamp);
    return sort === DEFAULT_SORT ? dateB - dateA : dateA - dateB;
  });
};

export const createFakeDate = (): Date => {
  return faker.date.between(BOTTOM_FROM, TOP_TO);
};
