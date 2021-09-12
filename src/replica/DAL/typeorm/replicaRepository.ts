import { Between, EntityRepository, FindConditions, FindOperator, LessThanOrEqual, MoreThan, Repository, In } from 'typeorm';
import { Replica, ReplicaMetadata, ReplicaWithFiles } from '../../models/replica';
import { PublicReplicaFilter, BaseReplicaFilter, PrivateReplicaFilter } from '../../models/replicaFilter';
import { IReplicaRepository } from '../IReplicaRepository';
import { Replica as ReplicaEntity } from './replica';
import { File as FileEntity } from './file';

const buildRangeFilter = <T>(from?: T, to?: T): FindOperator<T> | undefined => {
  if (from && to) {
    // TODO: is exclusive?
    return Between(from, to);
  } else if (from && !to) {
    return MoreThan(from);
  } else if (!from && to) {
    return LessThanOrEqual(to);
  }
  return undefined;
};

const IS_HIDDEN_DEFAULT_VALUE = true;

@EntityRepository(ReplicaEntity)
export class ReplicaRepository extends Repository<ReplicaEntity> implements IReplicaRepository {
  public async findOneReplica(replicaId: string): Promise<Replica | undefined> {
    return this.findOne(replicaId);
  }

  public async findOneReplicaWithFiles(replicaId: string): Promise<ReplicaWithFiles | undefined> {
    return this.findOne({
      join: {
        alias: 'replica',
        leftJoinAndSelect: {
          files: 'replica.files',
        },
      },
      where: { id: replicaId, isHidden: IS_HIDDEN_DEFAULT_VALUE },
    });
  }

  public async findReplicas(findOptions: PublicReplicaFilter): Promise<ReplicaWithFiles[]> {
    const { exclusiveFrom, to, sort, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions, isHidden: IS_HIDDEN_DEFAULT_VALUE };

    const timestampFilter = buildRangeFilter(exclusiveFrom, to);
    if (timestampFilter !== undefined) {
      whereConditions = { ...whereConditions, timestamp: timestampFilter };
    }

    const timestmapSort = sort === 'asc' ? 'ASC' : 'DESC';

    return this.find({
      join: {
        alias: 'replica',
        leftJoinAndSelect: {
          files: 'replica.files',
        },
      },
      where: whereConditions,
      order: { timestamp: timestmapSort },
    });
  }

  public async findLatestReplicaWithFiles(findOptions: BaseReplicaFilter): Promise<ReplicaWithFiles | undefined> {
    return this.findOne({
      join: {
        alias: 'replica',
        leftJoinAndSelect: {
          files: 'replica.files',
        },
      },
      where: { ...findOptions, isHidden: IS_HIDDEN_DEFAULT_VALUE },
      order: { timestamp: 'DESC' },
    });
  }

  public async createReplica(replica: Replica): Promise<void> {
    await this.insert(replica);
  }

  public async updateReplicas(findOptions: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
    const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions };

    const timestampFilter = buildRangeFilter(exclusiveFrom, to);
    if (timestampFilter !== undefined) {
      whereConditions = { ...whereConditions, timestamp: timestampFilter };
    }

    await this.update(whereConditions, updatedMetadata);
  }

  public async deleteReplicas(findOptions: PrivateReplicaFilter): Promise<ReplicaWithFiles[]> {
    const { exclusiveFrom, to, ...restOfFindOptions } = findOptions;
    let whereConditions: FindConditions<ReplicaEntity> = { ...restOfFindOptions };

    const timestampFilter = buildRangeFilter(exclusiveFrom, to);
    if (timestampFilter !== undefined) {
      whereConditions = { ...whereConditions, timestamp: timestampFilter };
    }

    // TODO: check onDelete
    const deletedReplicas = await this.manager.connection.transaction(async (transactionalEntityManager) => {
      const replicasToDelete = await transactionalEntityManager.find(ReplicaEntity, {
        where: whereConditions,
        join: {
          alias: 'replica',
          leftJoinAndSelect: {
            files: 'replica.files',
          },
        },
      });
      const replicaIds = replicasToDelete.map((replica) => replica.id);
      await transactionalEntityManager.delete(FileEntity, { replicaId: In(replicaIds) });
      await transactionalEntityManager.delete(ReplicaEntity, whereConditions);
      return replicasToDelete;
    });
    return deletedReplicas;
  }
}
