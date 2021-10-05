/* eslint-disable @typescript-eslint/no-unused-vars */
import faker from 'faker';
import { BUCKET_NAME_MIN_LENGTH_LIMIT } from '../../../../src/common/constants';
import { GeometryType, ReplicaType } from '../../../../src/common/enums';
import { ReplicaCreateBody } from '../../../../src/replica/models/replica';
import { BaseReplicaFilter, PublicReplicaFilter } from '../../../../src/replica/models/replicaFilter';

export type StringifiedReplica = Omit<ReplicaCreateBody, 'timestamp'> & { timestamp: string };
export type StringifiedReplicaUpdate = Partial<Omit<StringifiedReplica, 'replicaId'> & { isHidden: boolean }>;
export type StringifiedPublicReplicaFilter = Omit<PublicReplicaFilter, 'exclusiveFrom' | 'to'> & { exclusiveFrom?: string; to?: string };
export type StringifiedPrivateReplicaFilter = Omit<StringifiedPublicReplicaFilter, 'sort'> & { isHidden?: boolean };

export const getFakeReplica = (params: Partial<StringifiedReplica> = {}): StringifiedReplica => {
  return {
    replicaId: params.replicaId ?? `${faker.datatype.uuid()}`,
    replicaType: params.replicaType ?? faker.random.arrayElement(Object.values(ReplicaType)),
    geometryType: params.geometryType ?? faker.random.arrayElement(Object.values(GeometryType)),
    layerId: params.layerId ?? faker.datatype.number(),
    bucketName: params.bucketName ?? `${faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT })}`,
    timestamp: params.timestamp ?? faker.datatype.datetime().toISOString(),
  };
};

export const getFakeReplicaUpdate = (params: StringifiedReplicaUpdate = {}): StringifiedReplicaUpdate => {
  const { isHidden, ...restOfParams } = params;
  const fakeReplica = getFakeReplica(restOfParams);
  const { replicaId, ...rest } = fakeReplica;
  return {
    ...rest,
    isHidden: isHidden,
  };
};

export const getFakeBaseFilter = (params: Partial<BaseReplicaFilter> = {}): BaseReplicaFilter => {
  return {
    replicaType: params.replicaType ?? faker.random.arrayElement(Object.values(ReplicaType)),
    geometryType: params.geometryType ?? faker.random.arrayElement(Object.values(GeometryType)),
    layerId: params.layerId ?? faker.datatype.number(),
  };
};

export const getFakePublicFilter = (params: Partial<StringifiedPublicReplicaFilter> = {}): StringifiedPublicReplicaFilter => {
  const baseFilter = getFakeBaseFilter(params);
  return {
    ...baseFilter,
    exclusiveFrom: params.exclusiveFrom,
    to: params.to,
    sort: params.sort,
  };
};

export const getFakePrivateFilter = (params: Partial<StringifiedPrivateReplicaFilter> = {}): StringifiedPrivateReplicaFilter => {
  const publicFilter = getFakePublicFilter(params);
  return {
    isHidden: params.isHidden ?? faker.datatype.boolean(),
    ...publicFilter,
  };
};
