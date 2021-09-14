import { EntityRepository, Repository } from 'typeorm';
import { IFileRepository } from '../IFileRepository';
import { File } from '../../models/file';
import { File as FileEntity } from './file';

@EntityRepository(FileEntity)
export class FileRepository extends Repository<FileEntity> implements IFileRepository {
  public async findOneFile(fileId: string): Promise<File | undefined> {
    return this.findOne({ fileId });
  }

  public async createFileOnReplica(replicaId: string, fileId: string): Promise<void> {
    await this.insert({ replicaId, fileId });
  }
}
