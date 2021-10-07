import { GeometryType, ReplicaType } from '../../common/enums';
import { File } from './file';

export interface Replica {
  replicaId: string;

  layerId: number;

  replicaType: ReplicaType;

  geometryType: GeometryType;

  isHidden: boolean;

  timestamp: Date;

  bucketName: string;
}

export type ReplicaMetadata = Partial<Omit<Replica, 'replicaId'>>;

export type ReplicaCreateBody = Omit<Replica, 'isHidden'>;

export type ReplicaWithFiles = Replica & { files: File[] };

export interface ReplicaResponse extends Omit<Replica, 'replicaId' | 'isHidden' | 'bucketName'> {
  urls: string[];
}
