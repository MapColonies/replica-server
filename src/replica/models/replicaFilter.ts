import { GeometryType, ReplicaType } from '../../common/enums';
import { SortFilter } from '../../common/types';

export interface BaseReplicaFilter {
  replicaType: ReplicaType;
  geometryType: GeometryType;
  layerId: number;
}

export interface PublicReplicaFilter extends BaseReplicaFilter {
  exclusiveFrom?: Date;
  to?: Date;
  sort?: SortFilter;
}

export interface PrivateReplicaFilter extends Partial<Omit<PublicReplicaFilter, 'sort'>> {
  syncId?: string;
  isHidden?: boolean;
}
