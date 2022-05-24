import { DataSource, FindOperator, LessThanOrEqual, MoreThan, Raw, FindOptionsWhere } from 'typeorm';
import { FactoryFunction } from 'tsyringe';
import { Replica, ReplicaMetadata, ReplicaWithFiles } from '../../models/replica';
import { PublicReplicaFilter, BaseReplicaFilter, PrivateReplicaFilter } from '../../models/replicaFilter';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { Replica as ReplicaEntity } from './replica';

const buildTimestampFilter = (from?: Date, to?: Date): FindOperator<Date> | null => {
  if (from && to) {
    return Raw((timestamp) => `${timestamp} > :from AND ${timestamp} <= :to`, { from, to });
  } else if (from) {
    return MoreThan(from);
  } else if (to) {
    return LessThanOrEqual(to);
  }
  return null;
};

const IS_HIDDEN_FIND_VALUE = false;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createReplicaRepo = (dataSource: DataSource) => {
  return dataSource.getRepository(ReplicaEntity).extend({
    async findOneReplica(replicaId: string): Promise<Replica | null> {
      return this.findOneBy({ replicaId });
    },
    async findOneReplicaWithFiles(replicaId: string): Promise<ReplicaWithFiles | null> {
      return this.findOne({
        relations: ['files'],
        where: { replicaId, isHidden: IS_HIDDEN_FIND_VALUE },
      });
    },
    async findReplicas(findOptions: PublicReplicaFilter): Promise<ReplicaWithFiles[]> {
      const { exclusiveFrom, to, sort, ...restOfFindOptions } = findOptions;
      let whereConditions: FindOptionsWhere<ReplicaEntity> = { ...restOfFindOptions, isHidden: IS_HIDDEN_FIND_VALUE };
      const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
      if (timestampFilter !== null) {
        whereConditions = { ...whereConditions, timestamp: timestampFilter };
      }
      const timestamp = sort === 'asc' ? 'ASC' : 'DESC';
      return this.find({
        relations: ['files'],
        where: whereConditions,
        order: { timestamp },
      });
    },
    async findLatestReplicaWithFiles(findOptions: BaseReplicaFilter): Promise<ReplicaWithFiles | null> {
      return this.findOne({
        relations: ['files'],
        where: { ...findOptions, isHidden: IS_HIDDEN_FIND_VALUE },
        order: { timestamp: 'DESC' },
      });
    },
    async createReplica(replica: Replica): Promise<void> {
      await this.insert(replica);
    },
    async updateOneReplica(replicaId: string, updatedMetadata: ReplicaMetadata): Promise<void> {
      await this.update(replicaId, updatedMetadata);
    },
    async updateReplicas(findOptions: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
      const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
      let whereConditions: FindOptionsWhere<ReplicaEntity> = { ...restOfFindOptions };
      const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
      if (timestampFilter) {
        whereConditions = {
          ...whereConditions,
          timestamp: timestampFilter,
        };
      }
      await this.update(whereConditions, updatedMetadata);
    },
    async deleteOneReplica(replicaId: string): Promise<ReplicaWithFiles | null> {
      const deletedReplicas = await this.manager.connection.transaction(async (transactionalEntityManager) => {
        const replicaToDelete = await transactionalEntityManager.findOne(ReplicaEntity, {
          where: { replicaId },
          relations: ['files'],
        });

        if (replicaToDelete === null) {
          return replicaToDelete;
        }

        await transactionalEntityManager.remove(replicaToDelete);
        return replicaToDelete;
      });
      return deletedReplicas;
    },
    async deleteReplicas(findOptions: PrivateReplicaFilter): Promise<ReplicaWithFiles[]> {
      const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
      let whereConditions: FindOptionsWhere<ReplicaEntity> = { ...restOfFindOptions };
      const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
      if (timestampFilter !== null) {
        whereConditions = { ...whereConditions, timestamp: timestampFilter };
      }
      const deletedReplicas = await this.manager.connection.transaction(async (transactionalEntityManager) => {
        const replicasToDelete = await transactionalEntityManager.find(ReplicaEntity, {
          where: whereConditions,
          relations: ['files'],
        });
        await transactionalEntityManager.remove(replicasToDelete);
        return replicasToDelete;
      });
      return deletedReplicas;
    },
  });
};

export type ReplicaRepository = ReturnType<typeof createReplicaRepo>;

export const replicaRepositoryFactory: FactoryFunction<ReplicaRepository> = (depContainer) => {
  return createReplicaRepo(depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER));
};

export const REPLICA_CUSTOM_REPOSITORY_SYMBOL = Symbol('REPLICA_CUSTOM_REPOSITORY_SYMBOL');
