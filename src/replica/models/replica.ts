import { GeometryType, ReplicaType } from '../../common/enums';
import { File } from './file';

// TODO: remove if only used once
export type ReplicaMetadata = Partial<Omit<Replica, 'id'>>;

export type ReplicaWithFiles = Replica & { files: File[] };

export interface Replica {
  id: string;

  syncId: string;

  layerId: number;

  replicaType: ReplicaType;

  geometryType: GeometryType;

  isHidden: boolean;

  timestamp: Date;

  bucketName: string;
}

export interface ReplicaResponse extends Omit<Replica, 'id' | 'isHidden' | 'bucketName' | 'syncId'> {
  url: string[];
}
