import httpStatusCodes from 'http-status-codes';
import { QueryFailedError, Repository, DataSource } from 'typeorm';
import { Application } from 'express';
import { DependencyContainer } from 'tsyringe';
import { getConfig, initConfig } from '../../../src/common/config';
import { getApp } from '../../../src/app';
import { Layer as LayerEntity } from '../../../src/layer/DAL/typeorm/layer';
import { LAYER_REPOSITORY_SYMBOL } from '../../../src/layer/DAL/typeorm/layerRepository';
import { Layer } from '../../../src/layer/models/layer';
import { BEFORE_ALL_TIMEOUT, getBaseRegisterOptions } from '../helpers';
import { DATA_SOURCE_PROVIDER, initConnection } from '../../../src/common/db';
import { generateFakeLayers } from '../../helpers/helper';
import { LayerRequestSender } from './helpers/requestSender';

describe('layer', function () {
  let app: Application;
  let container: DependencyContainer;
  let connection: DataSource;
  let requestSender: LayerRequestSender;
  let mockLayerRequestSender: LayerRequestSender;
  let layerRepository: Repository<LayerEntity>;

  beforeAll(async function () {
    await initConfig(true);
    const config = getConfig();
    const dataSourceOptions = config.get('db');
    connection = await initConnection(dataSourceOptions);
    layerRepository = connection.getRepository(LayerEntity);
    await layerRepository.clear();

    const registerOptions = getBaseRegisterOptions();
    registerOptions.override.push({ token: DATA_SOURCE_PROVIDER, provider: { useValue: connection } });

    [container, app] = await getApp(registerOptions);
    requestSender = new LayerRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async function () {
    await connection.destroy();
    container.reset();
  });

  describe('Happy Path', function () {
    it('should return 200 status code and an empty array of layers when layers data is empty', async function () {
      await layerRepository.clear();
      const response = await requestSender.getLayers();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toMatchObject([]);
    });

    it('should return 200 status code and the existing layers', async function () {
      const layersToInsert = generateFakeLayers();
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
      mockRegisterOptions.override.push(
        {
          token: LAYER_REPOSITORY_SYMBOL,
          provider: { useValue: { findAllLayers: findAllLayersMock } },
        },
        { token: DATA_SOURCE_PROVIDER, provider: { useValue: connection } }
      );
      const [, mockApp] = await getApp(mockRegisterOptions);
      mockLayerRequestSender = new LayerRequestSender(mockApp);
      const response = await mockLayerRequestSender.getLayers();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('message', 'failed');
    });
  });
});
