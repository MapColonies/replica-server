import faker from 'faker';
import { GeometryType } from '../../../../src/common/enums';
import { Layer } from '../../../../src/layer/models/layer';

const createFakeLayer = (): Layer => {
  return {
    layerId: faker.datatype.number(),
    geometryTypes: faker.random.arrayElements(Object.values(GeometryType)),
    layerName: faker.random.word(),
  };
};

export const createFakeLayers = (): Layer[] => {
  const layers = [];
  const amount = faker.datatype.number({ min: 1, max: 10 });
  for (let i = 0; i < amount; i++) {
    layers.push(createFakeLayer());
  }
  return layers;
};
