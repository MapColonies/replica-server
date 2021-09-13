import { EntityRepository, FindConditions, FindOperator, LessThanOrEqual, MoreThan, Raw, Repository } from 'typeorm';
import { Replica, ReplicaMetadata, ReplicaWithFiles } from '../../models/replica';
import { PublicReplicaFilter, BaseReplicaFilter, PrivateReplicaFilter } from '../../models/replicaFilter';
import { IReplicaRepository } from '../IReplicaRepository';
import { Replica as ReplicaEntity } from './replica';

const buildTimestampFilter = (from?: Date, to?: Date): FindOperator<Date> | undefined => {
  if (from && to) {
    return Raw((timestamp) => `${timestamp} > :from AND ${timestamp} <= :to`, { from, to });
  } else if (from) {
    return MoreThan(from);
  } else if (to) {
    return LessThanOrEqual(to);
  }
  return undefined;
};

const IS_HIDDEN_FIND_VALUE = false;

@EntityRepository(ReplicaEntity)
export class ReplicaRepository extends Repository<ReplicaEntity> implements IReplicaRepository {
  public async findOneReplica(replicaId: string): Promise<Replica | undefined> {
    return this.findOne(replicaId);
  }

  public async findOneReplicaWithFiles(replicaId: string): Promise<ReplicaWithFiles | undefined> {
    return this.findOne({
      relations: ['files'],
      where: { replicaId, isHidden: IS_HIDDEN_FIND_VALUE },
    });
  }

  public async findReplicas(findOptions: PublicReplicaFilter): Promise<ReplicaWithFiles[]> {
    const { exclusiveFrom, to, sort, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions, isHidden: IS_HIDDEN_FIND_VALUE };
    const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
    if (timestampFilter !== undefined) {
      whereConditions = { ...whereConditions, timestamp: timestampFilter };
    }
    const timestmapSort = sort === 'asc' ? 'ASC' : 'DESC';
    return this.find({
      relations: ['files'],
      where: whereConditions,
      order: { timestamp: timestmapSort },
    });
  }

  public async findLatestReplicaWithFiles(findOptions: BaseReplicaFilter): Promise<ReplicaWithFiles | undefined> {
    return this.findOne({
      relations: ['files'],
      where: { ...findOptions, isHidden: IS_HIDDEN_FIND_VALUE },
      order: { timestamp: 'DESC' },
    });
  }

  public async createReplica(replica: Replica): Promise<void> {
    await this.insert(replica);
  }

  public async updateReplica(replicaId: string, updatedMetadata: ReplicaMetadata): Promise<void> {
    await this.update(replicaId, updatedMetadata);
  }

  public async updateReplicas(findOptions: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
    const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions };
    const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
    if (timestampFilter) {
      whereConditions = {
        ...whereConditions,
        timestamp: timestampFilter,
      };
    }
    await this.update(whereConditions, updatedMetadata);
  }

  public async deleteReplica(replicaId: string): Promise<ReplicaWithFiles | undefined> {
    const deletedReplicas = await this.manager.connection.transaction(async (transactionalEntityManager) => {
      const replicaToDelete = await transactionalEntityManager.findOne(ReplicaEntity, {
        where: { replicaId },
        relations: ['files'],
      });

      if (replicaToDelete === undefined) {
        return replicaToDelete;
      }

      await transactionalEntityManager.remove(replicaToDelete);
      return replicaToDelete;
    });
    return deletedReplicas;
  }

  public async deleteReplicas(findOptions: PrivateReplicaFilter): Promise<ReplicaWithFiles[]> {
    const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions };
    const timestampFilter = buildTimestampFilter(exclusiveFrom, to);
    if (timestampFilter !== undefined) {
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
  }
}
