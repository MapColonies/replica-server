import { EntityRepository, Repository } from 'typeorm';
import { IFileRepository } from '../IFileRepository';
import { File as FileEntity } from './file';

@EntityRepository(FileEntity)
export class FileRepository extends Repository<FileEntity> implements IFileRepository {
  public async createFileOnReplica(replicaId: string): Promise<void> {
    await this.insert({ replicaId });
  }
}
