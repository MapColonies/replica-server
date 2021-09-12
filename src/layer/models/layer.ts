import { GeometryType } from '../../common/enums';

export interface Layer {
  layerId: number;
  layerName: string;
  geometryTypes: GeometryType[];
}
