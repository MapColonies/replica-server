import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Services } from '../../common/constants';
import { removeUndefinedPropertiesFromObject } from '../../common/utils';
import { FILE_REPOSITORY_SYMBOL, IFileRepository } from '../DAL/IFileRepository';
import { IReplicaRepository, REPLICA_REPOSITORY_SYMBOL } from '../DAL/IReplicaRepository';
import { ReplicaNotFoundError, ReplicaAlreadyExistsError } from './errors';
import { Replica, ReplicaMetadata, ReplicaResponse } from './replica';
import { BaseReplicaFilter, PrivateReplicaFilter, PublicReplicaFilter } from './replicaFilter';

@injectable()
export class ReplicaManager {
  public constructor(
    @inject(REPLICA_REPOSITORY_SYMBOL) private readonly replicaRepository: IReplicaRepository,
    @inject(FILE_REPOSITORY_SYMBOL) private readonly fileRepository: IFileRepository,
    @inject(Services.LOGGER) private readonly logger: Logger
  ) {}

  public async getReplicaById(replicaId: string): Promise<ReplicaResponse> {
    const replicaWithFiles = await this.replicaRepository.findOneReplicaWithFiles(replicaId);
    if (replicaWithFiles === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    const { layerId, replicaType, geometryType, timestamp, files } = replicaWithFiles;
    // TODO: build url
    const urls = files.map((file) => `https://${file.fileId}.com`);
    return {
      replicaType,
      layerId,
      geometryType,
      timestamp,
      url: urls,
    };
  }

  public async getLatestReplica(replicaFilter: BaseReplicaFilter): Promise<ReplicaResponse> {
    const latestReplicaWithFiles = await this.replicaRepository.findLatestReplicaWithFiles(replicaFilter);
    if (latestReplicaWithFiles === undefined) {
      const { replicaType, geometryType, layerId } = replicaFilter;
      throw new ReplicaNotFoundError(`replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`);
    }
    const { layerId, replicaType, geometryType, timestamp, files } = latestReplicaWithFiles;
    // TODO: build url
    const urls = files.map((file) => `https://${file.fileId}.com`);
    return {
      replicaType,
      layerId,
      geometryType,
      timestamp,
      url: urls,
    };
  }

  public async getReplicas(filter: PublicReplicaFilter): Promise<ReplicaResponse[]> {
    removeUndefinedPropertiesFromObject(filter);
    const replicas = await this.replicaRepository.findReplicas(filter);
    return replicas.map((replica) => {
      const { layerId, replicaType, geometryType, timestamp, files } = replica;
      const urls = files.map((file) => `https://${file.fileId}.com`);
      return {
        replicaType,
        layerId,
        geometryType,
        timestamp,
        url: urls,
      };
    });
  }

  public async createReplica(replica: Replica): Promise<void> {
    const existingReplica = await this.replicaRepository.findOneReplica(replica.id);
    if (existingReplica) {
      throw new ReplicaAlreadyExistsError(`replica with id ${replica.id} already exists`);
    }
    await this.replicaRepository.createReplica({ ...replica, isHidden: true });
  }

  public async createFileOnReplica(replicaId: string): Promise<void> {
    const replica = await this.replicaRepository.findOneReplica(replicaId);
    if (replica === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    await this.fileRepository.createFileOnReplica(replicaId);
  }

  public async updateReplicas(filter: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
    removeUndefinedPropertiesFromObject(filter);
    await this.replicaRepository.updateReplicas(filter, updatedMetadata);
  }

  public async deleteReplicas(filter: PrivateReplicaFilter): Promise<ReplicaResponse[]> {
    removeUndefinedPropertiesFromObject(filter);
    const deletedReplicas = await this.replicaRepository.deleteReplicas(filter);
    return deletedReplicas.map((replica) => {
      const { layerId, replicaType, geometryType, timestamp, files } = replica;
      const urls = files.map((file) => `https://${file.fileId}.com`);
      return {
        replicaType,
        layerId,
        geometryType,
        timestamp,
        url: urls,
      };
    });
  }
}
