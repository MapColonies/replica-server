import faker from 'faker';
import { BUCKET_NAME_MIN_LENGTH_LIMIT } from '../../src/common/constants';
import { GeometryType, ReplicaType } from '../../src/common/enums';
import { IObjectStorageConfig } from '../../src/common/interfaces';
import { createUrlPaths } from '../../src/common/utils';
import { Layer } from '../../src/layer/models/layer';
import { File } from '../../src/replica/models/file';
import { ReplicaCreateBody, ReplicaResponse } from '../../src/replica/models/replica';
import { BaseReplicaFilter, PublicReplicaFilter } from '../../src/replica/models/replicaFilter';

type StringifiedReplicaResponse = Omit<ReplicaResponse, 'timestamp'> & { timestamp: string };

const generateFakeLayer = (): Layer => {
  return {
    layerId: faker.datatype.number(),
    geometryTypes: faker.random.arrayElements(Object.values(GeometryType)),
    layerName: faker.random.word(),
  };
};

export const generateFakeLayers = (): Layer[] => {
  const layers = [];
  const amount = faker.datatype.number({ min: 1, max: 10 });
  for (let i = 0; i < amount; i++) {
    layers.push(generateFakeLayer());
  }
  return layers;
};

export type StringifiedReplica = Omit<ReplicaCreateBody, 'timestamp'> & { timestamp: string };
export type StringifiedReplicaUpdate = Partial<Omit<StringifiedReplica, 'replicaId'> & { isHidden: boolean }>;
export type StringifiedPublicReplicaFilter = Omit<PublicReplicaFilter, 'exclusiveFrom' | 'to'> & { exclusiveFrom?: string; to?: string };
export type StringifiedPrivateReplicaFilter = Omit<StringifiedPublicReplicaFilter, 'sort'> & { isHidden?: boolean };

export const generateFakeReplicaUpdate = (params: StringifiedReplicaUpdate = {}): StringifiedReplicaUpdate => {
  const { isHidden, ...restOfParams } = params;
  const fakeReplica = generateFakeReplica(restOfParams);
  const { replicaId, ...rest } = fakeReplica;
  return {
    ...rest,
    isHidden: isHidden,
  };
};

export const generateMockObjectStorageConfig = (includeProjectId = false): IObjectStorageConfig => {
  const objectStorageConfig: IObjectStorageConfig = { protocol: 'http', host: 'some_storage_host', port: '9000' };
  if (includeProjectId) {
    objectStorageConfig.projectId = 'some_project_id';
  }
  return objectStorageConfig;
};

export const generateFakeReplica = (params: Partial<StringifiedReplica> = {}): StringifiedReplica => {
  return {
    replicaId: params.replicaId ?? `${faker.datatype.uuid()}`,
    replicaType: params.replicaType ?? faker.random.arrayElement(Object.values(ReplicaType)),
    geometryType: params.geometryType ?? faker.random.arrayElement(Object.values(GeometryType)),
    layerId: params.layerId ?? faker.datatype.number(),
    bucketName: params.bucketName ?? `${faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT })}`,
    timestamp: params.timestamp ?? faker.datatype.datetime().toISOString(),
  };
};

export const generateFakeReplicaWithFiles = (
  params: Partial<StringifiedReplica & { amount: number }> = {}
): { replica: StringifiedReplica & { files: File[] }; fileIds: string[] } => {
  const replica = generateFakeReplica(params);
  const amount = params.amount ?? faker.datatype.number({ min: 1, max: 10 });
  const files = [];
  for (let i = 0; i < amount; i++) {
    files.push({ replicaId: replica.replicaId, fileId: faker.datatype.uuid() });
  }
  return { replica: { ...replica, files }, fileIds: files.map((file) => file.fileId) };
};

export const generateFakeBaseFilter = (params: Partial<BaseReplicaFilter> = {}): BaseReplicaFilter => {
  return {
    replicaType: params.replicaType ?? faker.random.arrayElement(Object.values(ReplicaType)),
    geometryType: params.geometryType ?? faker.random.arrayElement(Object.values(GeometryType)),
    layerId: params.layerId ?? faker.datatype.number({ min: 1 }),
  };
};

export const generateFakePublicFilter = (params: Partial<StringifiedPublicReplicaFilter> = {}): StringifiedPublicReplicaFilter => {
  const baseFilter = generateFakeBaseFilter(params);
  return {
    ...baseFilter,
    exclusiveFrom: params.exclusiveFrom,
    to: params.to,
    sort: params.sort,
  };
};

export const generateFakePrivateFilter = (params: Partial<StringifiedPrivateReplicaFilter> = {}): StringifiedPrivateReplicaFilter => {
  const publicFilter = generateFakePublicFilter(params);
  return {
    isHidden: params.isHidden ?? faker.datatype.boolean(),
    ...publicFilter,
  };
};

export const convertReplicaToResponse = (replica: StringifiedReplica, fileIds?: string[], includeProjectId = false): StringifiedReplicaResponse => {
  const urls = fileIds !== undefined ? convertReplicaToUrls(replica, fileIds, includeProjectId) : [];
  const { replicaId, bucketName, ...restOfMetadata } = replica;
  return { ...restOfMetadata, urls };
};

export const convertReplicaToUrls = (replica: StringifiedReplica, fileIds: string[], includeProjectId = false): string[] => {
  const { protocol, host, projectId, port } = generateMockObjectStorageConfig(includeProjectId);
  const { bucketName, layerId, geometryType } = replica;

  let bucketOrProjectIdWithBucket = bucketName;
  if (includeProjectId && projectId !== undefined) {
    bucketOrProjectIdWithBucket = `${projectId}:${bucketName}`;
  }
  const header = `${protocol}://${host}:${port}`;
  return createUrlPaths(header, [bucketOrProjectIdWithBucket, layerId.toString(), geometryType], fileIds);
};
