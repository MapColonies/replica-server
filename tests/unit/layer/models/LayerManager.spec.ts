import jsLogger from '@map-colonies/js-logger';
import { LayerRepository } from '../../../../src/layer/DAL/typeorm/layerRepository';
import { LayerManager } from '../../../../src/layer/models/layerManager';
import { generateFakeLayers } from '../../../helpers/helper';

let layerManager: LayerManager;

describe('LayerManager', () => {
  let findAllLayersMock: jest.Mock;

  beforeAll(function () {
    findAllLayersMock = jest.fn();
    const layerRepository: LayerRepository = { findAllLayers: findAllLayersMock } as unknown as LayerRepository;
    layerManager = new LayerManager(layerRepository, jsLogger({ enabled: false }));
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  describe('#getAllLayers', () => {
    it('should return an empty array the existing layers', async function () {
      findAllLayersMock.mockResolvedValue([]);
      const getAllLayersPromise = layerManager.getAllLayers();

      await expect(getAllLayersPromise).resolves.not.toThrow();
      await expect(getAllLayersPromise).resolves.toMatchObject([]);
    });

    it('should return all existing layers', async function () {
      const layers = generateFakeLayers();

      findAllLayersMock.mockResolvedValue(layers);
      const getAllLayersPromise = layerManager.getAllLayers();

      await expect(getAllLayersPromise).resolves.not.toThrow();
      await expect(getAllLayersPromise).resolves.toMatchObject(layers);
    });
  });
});
