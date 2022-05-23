import { DataSource } from 'typeorm';
import { FactoryFunction } from 'tsyringe';
import { File } from '../../models/file';
import { File as FileEntity } from './file';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createFileRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(FileEntity).extend({
    async findOneFile(fileId: string): Promise<File | null> {
      return this.findOneBy({ fileId });
    },
    async createFileOnReplica(replicaId: string, fileId: string): Promise<void> {
      await this.insert({ replicaId, fileId });
    },
  });
};

export const fileRepositoryFactory: FactoryFunction<ReturnType<typeof createFileRepository>> = (depContainer) => {
  return createFileRepository(depContainer.resolve<DataSource>(DataSource));
};

export type FileRepository = ReturnType<typeof createFileRepository>;

export const FILE_CUSTOM_REPOSITORY_SYMBOL = Symbol('FILE_CUSTOM_REPOSITORY_SYMBOL');
