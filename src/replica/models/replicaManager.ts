import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Services } from '../../common/constants';
import { IObjectStorageConfig } from '../../common/interfaces';
import { createUrlPaths, isStringUndefinedOrEmpty } from '../../common/utils';
import { FILE_CUSTOM_REPOSITORY_SYMBOL, FileRepository } from '../DAL/typeorm/fileRepository';
import { ReplicaRepository, REPLICA_CUSTOM_REPOSITORY_SYMBOL } from '../DAL/typeorm/replicaRepository';
import { ReplicaNotFoundError, ReplicaAlreadyExistsError, FileAlreadyExistsError } from './errors';
import { ReplicaCreateBody, ReplicaMetadata, ReplicaResponse, ReplicaWithFiles } from './replica';
import { BaseReplicaFilter, PrivateReplicaFilter, PublicReplicaFilter } from './replicaFilter';

@injectable()
export class ReplicaManager {
  private readonly urlHeader: string;

  public constructor(
    @inject(REPLICA_CUSTOM_REPOSITORY_SYMBOL) private readonly replicaRepository: ReplicaRepository,
    @inject(FILE_CUSTOM_REPOSITORY_SYMBOL) private readonly fileRepository: FileRepository,
    @inject(Services.LOGGER) private readonly logger: Logger,
    @inject(Services.OBJECT_STORAGE) private readonly objectStorageConfig: IObjectStorageConfig
  ) {
    const { protocol, host, port } = this.objectStorageConfig;
    this.urlHeader = `${protocol}://${host}:${port}`;
  }

  public async getReplicaById(replicaId: string): Promise<ReplicaResponse> {
    this.logger.info({ msg: 'getting replica by id', replicaId });

    const replicaWithFiles = await this.replicaRepository.findOneReplicaWithFiles(replicaId);
    if (replicaWithFiles === null) {
      this.logger.error({ msg: 'could not find replica by id', replicaId });
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
    this.logger.info({ msg: 'getting latest replica by filter', ...replicaFilter });

    const latestReplicaWithFiles = await this.replicaRepository.findLatestReplicaWithFiles(replicaFilter);
    if (latestReplicaWithFiles === null) {
      this.logger.error({ msg: 'could not find latest replica', ...replicaFilter });
      const { replicaType, geometryType, layerId } = replicaFilter;
      throw new ReplicaNotFoundError(`replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`);
    }

    this.logger.debug({
      msg: 'fetched lastest replica',
      ...replicaFilter,
      replicaId: latestReplicaWithFiles.replicaId,
      filesCount: latestReplicaWithFiles.files.length,
    });

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
    this.logger.info({ msg: 'getting replicas by filter', filter });

    const replicas = await this.replicaRepository.findReplicas(filter);

    this.logger.debug({ msg: 'fetched replicas matching filter', filter, count: replicas.length });

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
    this.logger.info({ msg: 'creating new replica', replicaId: replica.replicaId });

    const existingReplica = await this.replicaRepository.findOneReplica(replica.replicaId);
    if (existingReplica) {
      this.logger.error({ msg: 'could not create replica, replica with the same id already exists', replicaId: replica.replicaId });
      throw new ReplicaAlreadyExistsError(`replica with id ${replica.replicaId} already exists`);
    }

    await this.replicaRepository.createReplica({ ...replica, isHidden: true });
  }

  public async createFileOnReplica(replicaId: string, fileId: string): Promise<void> {
    this.logger.info({ msg: 'creating new file on replica', replicaId, fileId });

    const replica = await this.replicaRepository.findOneReplica(replicaId);
    if (replica === null) {
      this.logger.error({ msg: 'could not find replica to create a file on it', replicaId });
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }

    const existingFile = await this.fileRepository.findOneFile(fileId);
    if (existingFile) {
      this.logger.error({ msg: 'could not create file, file with the same id already exists', replicaId, fileId });
      throw new FileAlreadyExistsError(`file with id ${fileId} already exists`);
    }

    await this.fileRepository.createFileOnReplica(replicaId, fileId);

    this.logger.debug({ msg: 'created file on replica', replicaId, fileId });
  }

  public async updateReplica(replicaId: string, updatedMetadata: ReplicaMetadata): Promise<void> {
    this.logger.info({ msg: 'updating replica', replicaId });

    const replica = await this.replicaRepository.findOneReplica(replicaId);
    if (replica === null) {
      this.logger.error({ msg: 'could not update replica, replica with specified replica id was not found', replicaId });
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }

    await this.replicaRepository.updateOneReplica(replicaId, updatedMetadata);
  }

  public async updateReplicas(filter: PrivateReplicaFilter, updatedMetadata: ReplicaMetadata): Promise<void> {
    this.logger.info({ msg: 'updating replicas by filter', filter });

    await this.replicaRepository.updateReplicas(filter, updatedMetadata);
  }

  public async deleteReplica(replicaId: string): Promise<ReplicaResponse> {
    this.logger.info({ msg: 'deleting replica', replicaId });

    const deletedReplica = await this.replicaRepository.deleteOneReplica(replicaId);
    if (deletedReplica === null) {
      this.logger.error({ msg: 'could not delete replica, replica with specified replica id was not found', replicaId });
      throw new ReplicaNotFoundError(`replica with id ${replicaId} was not found`);
    }

    this.logger.debug({ msg: 'deleted replica', replicaId });

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
    this.logger.info({ msg: 'deleting replicas by filter', filter });

    const deletedReplicas = await this.replicaRepository.deleteReplicas(filter);

    this.logger.debug({ msg: 'deleted replicas matching filter', filter, count: deletedReplicas.length });
    return deletedReplicas.map((replica) => {
      this.logger.debug({ msg: 'deleted replica', replicaId: replica.replicaId });

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
