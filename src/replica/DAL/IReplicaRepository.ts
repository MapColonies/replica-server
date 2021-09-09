import { Replica, ReplicaMetadata, ReplicaWithFiles } from '../models/replica';
import {} from './typeorm/replica';
import { BaseReplicaFilter, ReplicaFilter, ReplicasQueryFilter } from '../models/replicaFilter';

export const REPLICA_REPOSITORY_SYMBOL = Symbol('ReplicaRepository');

export interface IReplicaRepository {
  findOneReplica: (replicaId: string) => Promise<Replica | undefined>;
  findOneReplicaWithFiles: (replicaId: string) => Promise<ReplicaWithFiles | undefined>;
  findReplicas: (replicasFilter: ReplicaFilter) => Promise<Replica[] | undefined>;
  findLatestReplica: (baseReplicaFilter: BaseReplicaFilter) => Promise<Replica | undefined>;
  findLatestReplicaWithFiles: (baseReplicaFilter: BaseReplicaFilter) => Promise<ReplicaWithFiles | undefined>;
  createReplica: (replica: Replica) => Promise<void>;
  // updateReplicas: (replicasUpdatedMetadata: ReplicaMetadata, filter: ReplicasQueryFilter) => Promise<void>;
  // deleteReplicas: (filter: ReplicasQueryFilter) => Promise<Replica[]>;
}
