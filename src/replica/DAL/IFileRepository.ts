export const FILE_REPOSITORY_SYMBOL = Symbol('FileRepository');

export interface IFileRepository {
  createFileOnReplica: (replicaId: string) => Promise<void>;
}
