import { EntityRepository, Repository } from 'typeorm';
import { File } from '../../models/file';
import { IFileRepository } from '../IFileRepository';
import { File as FileEntity } from './file';

@EntityRepository(FileEntity)
export class FileRepository extends Repository<FileEntity> implements IFileRepository {
  // TODO: remove if not needed
  public async findFilesOfReplica(replicaId: string): Promise<File[]> {
    return this.find({ where: { replicaId } });
  }

  public async createFileOnReplica(replicaId: string): Promise<void> {
    await this.insert({ replicaId });
  }
}
