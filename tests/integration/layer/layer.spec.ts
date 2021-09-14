import config from 'config';
import httpStatusCodes from 'http-status-codes';
import { container } from 'tsyringe';
import { Connection, QueryFailedError, Repository } from 'typeorm';
import { getApp } from '../../../src/app';
import { LAYER_REPOSITORY_SYMBOL } from '../../../src/layer/DAL/ILayerRepository';
import { Layer as LayerEntity } from '../../../src/layer/DAL/typeorm/layer';
import { Layer } from '../../../src/layer/models/layer';
import { initConnection } from '../../../src/common/db';
import { DbConfig } from '../../../src/common/interfaces';
import { getBaseRegisterOptions } from '../helpers';
import { createFakeLayers } from './helpers/generators';
import { LayerRequestSender } from './helpers/requestSender';

describe('layer', function () {
  let requestSender: LayerRequestSender;
  let mockLayerRequestSender: LayerRequestSender;
  let connection: Connection;
  let layerRepository: Repository<LayerEntity>;

  beforeAll(async function () {
    const registerOptions = getBaseRegisterOptions();

    const connectionOptions = config.get<DbConfig>('db');
    connection = await initConnection(connectionOptions);
    registerOptions.override.push({ token: Connection, provider: { useValue: connection } });
    const app = await getApp(registerOptions);
    requestSender = new LayerRequestSender(app);
    layerRepository = connection.getRepository(LayerEntity);
  });

  afterAll(async function () {
    await layerRepository.clear();
    await connection.close();
    container.reset();
  });

  describe('Happy Path', function () {
    it('should return 200 status code and an empty array of layers when layers data is empty', async function () {
      const response = await requestSender.getLayers();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toMatchObject([]);
    });

    it('should return 200 status code and the existing layers', async function () {
      const layersToInsert = createFakeLayers();
      await layerRepository.insert(layersToInsert);
      const insertedLayers: Layer[] = layersToInsert.map((layer) => {
        const { layerId, layerName, geometryTypes } = layer;
        return { layerId, layerName, geometryTypes };
      });

      const response = await requestSender.getLayers();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toEqual(expect.arrayContaining(insertedLayers));
    });
  });

  describe('Sad Path', function () {
    it('should return 500 if the db throws an error', async function () {
      const findAllLayersMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
      const mockRegisterOptions = getBaseRegisterOptions();
      mockRegisterOptions.override.push({
        token: LAYER_REPOSITORY_SYMBOL,
        provider: { useValue: { findAllLayers: findAllLayersMock } },
      });
      const mockApp = await getApp(mockRegisterOptions);
      mockLayerRequestSender = new LayerRequestSender(mockApp);
      const response = await mockLayerRequestSender.getLayers();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('message', 'failed');
    });
  });
});
