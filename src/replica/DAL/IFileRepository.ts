import { File } from '../models/file';

export const FILE_REPOSITORY_SYMBOL = Symbol('FileRepository');
export interface IFileRepository {
  findOneFile: (fileId: string) => Promise<File | undefined>;
  createFileOnReplica: (replicaId: string, fileId: string) => Promise<void>;
}
