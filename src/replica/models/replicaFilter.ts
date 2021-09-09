/* eslint-disable @typescript-eslint/naming-convention */
import { GeometryType, ReplicaType } from '../../common/enums';
import { SortFilter } from '../../common/types';

export interface BaseReplicaFilter {
  replicaType: ReplicaType;
  geometryType: GeometryType;
  layerId: number;
}

// TODO: with PickRename
export interface BaseReplicaFilterQueryParams {
  replica_type: ReplicaType;
  geometry_type: GeometryType;
  layer_id: number;
}

export interface ReplicaFilter extends BaseReplicaFilter {
  from: Date;
  to: Date;
  sort?: SortFilter;
}

export interface ReplicasQueryFilter extends Partial<Omit<ReplicaFilter, 'sort'>> {
  syncId?: string;
  isHidden?: boolean;
}
