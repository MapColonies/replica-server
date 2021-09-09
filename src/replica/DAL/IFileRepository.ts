import { File } from '../models/file';

export const FILE_REPOSITORY_SYMBOL = Symbol('FileRepository');

export interface IFileRepository {
  findFilesOfReplica: (replicaId: string) => Promise<File[]>;
  createFileOnReplica: (replicaId: string) => Promise<void>;
}
