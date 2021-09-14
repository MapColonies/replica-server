import faker from 'faker';
import { GeometryType, ReplicaType } from '../../../../src/common/enums';
import { ReplicaCreateBody } from '../../../../src/replica/models/replica';

type FakeReplicaParams = Partial<StringifiedReplica>;

export type StringifiedReplica = Omit<ReplicaCreateBody, 'timestamp'> & { timestamp: string };

export const getFakeReplica = (params: FakeReplicaParams = {}): StringifiedReplica => {
  return {
    replicaId: params.replicaId ?? `${faker.datatype.uuid()}`,
    replicaType: params.replicaType ?? faker.random.arrayElement(Object.values(ReplicaType)),
    geometryType: params.geometryType ?? faker.random.arrayElement(Object.values(GeometryType)),
    layerId: params.layerId ?? faker.datatype.number(),
    bucketName: params.bucketName ?? `${faker.random.word()}`,
    timestamp: params.timestamp ?? faker.datatype.datetime().toISOString(),
  };
};
