import { Between, EntityManager, EntityRepository, Repository } from 'typeorm';
import { Replica, ReplicaWithFiles } from '../../models/replica';
import { ReplicaFilter, BaseReplicaFilter, ReplicasQueryFilter } from '../../models/replicaFilter';
import { IReplicaRepository } from '../IReplicaRepository';
import { Replica as ReplicaEntity } from './replica';

@EntityRepository(ReplicaEntity)
export class ReplicaRepository extends Repository<ReplicaEntity> implements IReplicaRepository {
  public async findOneReplica(replicaId: string): Promise<Replica | undefined> {
    const replica = await this.findOne(replicaId);
    if (!replica) {
      return undefined;
    }
    return replica;
  }

  public async findOneReplicaWithFiles(replicaId: string): Promise<ReplicaWithFiles | undefined> {
    const replica = await this.createQueryBuilder('replica')
      .leftJoinAndSelect('replica.files', 'file')
      .where(`id = :replicaId`, { replicaId })
      .andWhere(`is_hidden = :isHidden`, { isHidden: false })
      .getOne();

    return replica;
  }

  public async findReplicas(replicasFilter: ReplicaFilter): Promise<Replica[] | undefined> {
    const { replicaType, geometryType, layerId, to, from, sort } = replicasFilter;
    const timestmapSort = sort === 'asc' ? 'ASC' : 'DESC';
    const replicas = await this.find({
      where: {
        replicaType,
        geometryType,
        layerId,
        timestamp: Between(from, to),
      },
      order: { timestamp: timestmapSort },
    });
    if (replicas.length === 0) {
      return undefined;
    }
    return replicas;
  }

  public async findLatestReplica(baseReplicaFilter: BaseReplicaFilter): Promise<Replica | undefined> {
    const { replicaType, geometryType, layerId } = baseReplicaFilter;
    const latestReplica = await this.find({
      where: { replicaType, geometryType, layerId, isHidden: false },
      order: { timestamp: 'DESC' },
      take: 1,
    });
    if (latestReplica.length !== 1) {
      return undefined;
    }
    return latestReplica[0];
  }

  public async findLatestReplicaWithFiles(baseReplicaFilter: BaseReplicaFilter): Promise<ReplicaWithFiles | undefined> {
    const { replicaType, geometryType, layerId } = baseReplicaFilter;
    const replica = await this.createQueryBuilder('replica')
      .leftJoinAndSelect('replica.files', 'file')
      .where(`replica.replica_type = :replicaType`, { replicaType })
      .andWhere(`geometry_type = :geometryType`, { geometryType })
      .andWhere(`layer_id = :layerId`, { layerId })
      .andWhere(`is_hidden = :isHidden`, { isHidden: false })
      .orderBy({ timestamp: 'DESC' })
      .getOne();

    return replica;
  }

  public async createReplica(replica: Replica): Promise<void> {
    await this.insert(replica);
  }

  // updateReplicas: (replicasUpdatedMetadata: Partial<Pick<Replica, "syncId" | "layerId" | "replicaType" | "geometryType" | "isHidden" | "timestamp" | "bucketName">>, filter: ReplicasQueryFilter) => Promise<...>;
  // public async deleteReplicas (filter: ReplicasQueryFilter): Promise<Replica[]> {
  //     // loop on filters to be added to where \ and where
  //     const { syncId, layerId, replicaType, geometryType, isHidden, from, to } = filter;

  //     // TODO: is join necessary
  //     await this.manager.connection.transaction(async (transactionalEntityManager) => {
  //         const replicas = await transactionalEntityManager
  //         .createQueryBuilder(ReplicaEntity, 'replica')
  //         .leftJoinAndSelect('replica.files', 'file')
  //         .from(ReplicaEntity, 'replica')
  //         .where(`syncId = :syncId`, { syncId })
  //         .getMany();
  //     })

  // }
}
