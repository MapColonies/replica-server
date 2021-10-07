import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Services } from '../../common/constants';
import { IObjectStorageConfig } from '../../common/interfaces';
import { FILE_REPOSITORY_SYMBOL, IFileRepository } from '../DAL/IFileRepository';
import { IReplicaRepository, REPLICA_REPOSITORY_SYMBOL } from '../DAL/IReplicaRepository';
import { createUrlPaths, isStringUndefinedOrEmpty } from '../../common/utils';
import { ReplicaNotFoundError, ReplicaAlreadyExistsError, FileAlreadyExistsError } from './errors';
import { ReplicaCreateBody, ReplicaMetadata, ReplicaResponse, ReplicaWithFiles } from './replica';
import { BaseReplicaFilter, PrivateReplicaFilter, PublicReplicaFilter } from './replicaFilter';

@injectable()
export class ReplicaManager {
  private readonly urlHeader: string;

  public constructor(
    @inject(REPLICA_REPOSITORY_SYMBOL) private readonly replicaRepository: IReplicaRepository,
    @inject(FILE_REPOSITORY_SYMBOL) private readonly fileRepository: IFileRepository,
    @inject(Services.LOGGER) private readonly logger: Logger,
    @inject(Services.OBJECT_STORAGE) private readonly objectStorageConfig: IObjectStorageConfig
  ) {
    const { protocol, host, port } = this.objectStorageConfig;
    this.urlHeader = `${protocol}://${host}:${port}`;
  }

  public async getReplicaById(replicaId: string): Promise<ReplicaResponse> {
    const replicaWithFiles = await this.replicaRepository.findOneReplicaWithFiles(replicaId);
    if (replicaWithFiles === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    const { layerId, replicaType, geometryType, timestamp } = replicaWithFiles;
    const urls = this.getReplicaUrls(replicaWithFiles);
    return {
      replicaType,
      layerId,
      geometryType,
      timestamp,
      urls,
    };
  }

  public async getLatestReplica(replicaFilter: BaseReplicaFilter): Promise<ReplicaResponse> {
    const latestReplicaWithFiles = await this.replicaRepository.findLatestReplicaWithFiles(replicaFilter);
    if (latestReplicaWithFiles === undefined) {
      const { replicaType, geometryType, layerId } = replicaFilter;
      throw new ReplicaNotFoundError(`replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`);
    }
    const { layerId, replicaType, geometryType, timestamp } = latestReplicaWithFiles;
    const urls = this.getReplicaUrls(latestReplicaWithFiles);
    return {
      replicaType,
      layerId,
      geometryType,
      timestamp,
      urls,
    };
  }

  public async getReplicas(filter: PublicReplicaFilter): Promise<ReplicaResponse[]> {
    const replicas = await this.replicaRepository.findReplicas(filter);
    return replicas.map((replica) => {
      const { layerId, replicaType, geometryType, timestamp } = replica;
      const urls = this.getReplicaUrls(replica);
      return {
        replicaType,
        layerId,
        geometryType,
        timestamp,
        urls,
      };
    });
  }

  public async createReplica(replica: ReplicaCreateBody): Promise<void> {
    const existingReplica = await this.replicaRepository.findOneReplica(replica.replicaId);
    if (existingReplica) {
      throw new ReplicaAlreadyExistsError(`replica with id ${replica.replicaId} already exists`);
    }
    await this.replicaRepository.createReplica({ ...replica, isHidden: true });
  }

  public async createFileOnReplica(replicaId: string, fileId: string): Promise<void> {
    const replica = await this.replicaRepository.findOneReplica(replicaId);
    if (replica === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    const existingFile = await this.fileRepository.findOneFile(fileId);
    if (existingFile) {
      throw new FileAlreadyExistsError(`file with id ${fileId} already exists`);
    }
    await this.fileRepository.createFileOnReplica(replicaId, fileId);
  }

  public async updateReplica(replicaId: string, updatedMetadata: ReplicaMetadata): Promise<void> {
    const replica = await this.replicaRepository.findOneReplica(replicaId);
    if (replica === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    await this.replicaRepository.updateOneReplica(replicaId, updatedMetadata);
  }

  public async updateReplicas(filter: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
    await this.replicaRepository.updateReplicas(filter, updatedMetadata);
  }

  public async deleteReplica(replicaId: string): Promise<ReplicaResponse> {
    const deletedReplica = await this.replicaRepository.deleteOneReplica(replicaId);
    if (deletedReplica === undefined) {
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }
    const { layerId, replicaType, geometryType, timestamp } = deletedReplica;
    const urls = this.getReplicaUrls(deletedReplica);
    return {
      replicaType,
      layerId,
      geometryType,
      timestamp,
      urls,
    };
  }

  public async deleteReplicas(filter: PrivateReplicaFilter): Promise<ReplicaResponse[]> {
    const deletedReplicas = await this.replicaRepository.deleteReplicas(filter);
    return deletedReplicas.map((replica) => {
      const { layerId, replicaType, geometryType, timestamp } = replica;
      const urls = this.getReplicaUrls(replica);
      return {
        replicaType,
        layerId,
        geometryType,
        timestamp,
        urls,
      };
    });
  }

  private getReplicaUrls(replicaWithFiles: ReplicaWithFiles): string[] {
    const { bucketName, layerId, geometryType, files } = replicaWithFiles;
    const { projectId } = this.objectStorageConfig;
    let bucketOrProjectIdWithBucket = bucketName;
    if (!isStringUndefinedOrEmpty(projectId)) {
      bucketOrProjectIdWithBucket = `${projectId}:${bucketName}`;
    }
    return createUrlPaths(
      `${this.urlHeader}`,
      [bucketOrProjectIdWithBucket, layerId.toString(), geometryType],
      files.map((file) => file.fileId)
    );
  }
}
