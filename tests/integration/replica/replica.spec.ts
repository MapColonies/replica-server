/* eslint-disable @typescript-eslint/no-unused-vars */
import config from 'config';
import httpStatusCodes, { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { Connection, QueryFailedError, Repository } from 'typeorm';
import faker from 'faker';
import { getApp } from '../../../src/app';
import { Replica as ReplicaEntity } from '../../../src/replica/DAL/typeorm/replica';
import { convertReplicaToUrls, getBaseRegisterOptions, getMockObjectStorageConfig } from '../helpers';
import { BUCKET_NAME_MAX_LENGTH_LIMIT, BUCKET_NAME_MIN_LENGTH_LIMIT, Services } from '../../../src/common/constants';
import { GeometryType, ReplicaType } from '../../../src/common/enums';
import { REPLICA_REPOSITORY_SYMBOL } from '../../../src/replica/DAL/IReplicaRepository';
import { DbConfig } from '../../../src/common/interfaces';
import { BaseReplicaFilter } from '../../../src/replica/models/replicaFilter';
import { initConnection } from '../../../src/common/db';
import { FILE_REPOSITORY_SYMBOL } from '../../../src/replica/DAL/IFileRepository';
import { ReplicaRequestSender } from './helpers/requestSender';
import { getFakeBaseFilter, getFakeReplica, getFakeReplicaUpdate, StringifiedReplica, StringifiedReplicaUpdate } from './helpers/generators';

describe('replica', function () {
  let requestSender: ReplicaRequestSender;
  let mockReplicaRequestSender: ReplicaRequestSender;
  let connection: Connection;
  let replicaRepository: Repository<ReplicaEntity>;

  beforeAll(async function () {
    const registerOptions = getBaseRegisterOptions();

    const connectionOptions = config.get<DbConfig>('db');
    connection = await initConnection(connectionOptions);
    registerOptions.override.push({ token: Connection, provider: { useValue: connection } });
    registerOptions.override.push({ token: Services.OBJECT_STORAGE, provider: { useValue: getMockObjectStorageConfig() } });
    const app = await getApp(registerOptions);
    requestSender = new ReplicaRequestSender(app);
    replicaRepository = connection.getRepository(ReplicaEntity);
  });

  afterAll(async function () {
    await connection.close();
    container.reset();
  });

  describe('Happy Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 200 status code and the requested replica', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);

        const response = await requestSender.getReplicaById(replicaId);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });

      it('should return 200 status code and the requested replica with its files', async function () {
        const replica = getFakeReplica();
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const response = await requestSender.getReplicaById(replicaId);

        const urls = convertReplicaToUrls(replica, fileIds);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls });
      });

      it('should return 200 status code and the requested replica with its files when projectId is configured', async function () {
        const replica = getFakeReplica();
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);

        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({ token: Services.OBJECT_STORAGE, provider: { useValue: getMockObjectStorageConfig(true) } });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.getReplicaById(replicaId);

        const urls = convertReplicaToUrls(replica, fileIds, true);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls });
      });
    });

    describe('GET /replica/latest', function () {
      it('should return 200 status code and the latest replica according to filter', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const { replicaType, geometryType, layerId } = replica;
        const filter = getFakeBaseFilter({ replicaType: replicaType, geometryType: geometryType, layerId: layerId });

        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });

      it('should return 200 status code and the latest replica with its files according to filter', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const { replicaType, geometryType, layerId } = replica;
        const filter = getFakeBaseFilter({ replicaType: replicaType, geometryType: geometryType, layerId: layerId });

        const response = await requestSender.getLatestReplica(filter);

        const urls = convertReplicaToUrls(replica, fileIds);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: urls });
      });
    });

    describe('POST /replica', function () {
      it('should return 201 status code for creating a new replica', async function () {
        const replica = getFakeReplica();
        const response = await requestSender.postReplica(replica);

        expect(response).toHaveProperty('status', httpStatusCodes.CREATED);
      });
    });

    describe('POST /replica/{replicaId}', function () {
      it('should return 201 status code for creating a new file on replica', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postFile(replica.replicaId, faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.CREATED);
      });
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 200 status code for deleting a replica and all its files and return the full replica as body', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.deleteReplica(replica.replicaId);

        const urls = convertReplicaToUrls(replica, fileIds);

        expect(response).toHaveProperty('status', httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls });
      });

      it('should return 200 status code for deleting a replica with it as body', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.deleteReplica(replica.replicaId);

        const { replicaId, bucketName, ...restOfMetadata } = replica;

        expect(response).toHaveProperty('status', httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 200 status code for updating a replica', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const replicaUpdate = getFakeReplicaUpdate();

        const response = await requestSender.patchReplica(replica.replicaId, replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.OK);
      });
    });
  });

  describe('Bad Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 400 if the replica id is not valid', async function () {
        const response = await requestSender.getReplicaById('invalidId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.replicaId should match format "uuid"');
      });

      it('should return 404 if the replica with the given replicaId was not found', async function () {
        const fakeId = faker.datatype.uuid();
        const response = await requestSender.getReplicaById(fakeId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeId} was not found`);
      });

      it('should return 404 if the replica with the given replica id is hidden', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId } = replica;

        const response = await requestSender.getReplicaById(replicaId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${replicaId} was not found`);
      });
    });

    describe('GET /replica/latest', function () {
      it.each([
        [
          getFakeBaseFilter({ replicaType: faker.random.word() as ReplicaType }),
          `request.query.replica_type should be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          getFakeBaseFilter({ geometryType: faker.random.word() as GeometryType }),
          `request.query.geometry_type should be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [getFakeBaseFilter({ layerId: (faker.random.word() as unknown) as number }), `request.query.layer_id should be number`],
      ])(
        'should return 400 status code if the filter has an invalid query parameter',
        async function (filter: BaseReplicaFilter, bodyMessage: string) {
          const response = await requestSender.getLatestReplica(filter);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );

      it('should return 400 if replica type is missing on query filter', async function () {
        const filter = getFakeBaseFilter();
        const { replicaType, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request.query should have required property 'replica_type'`);
      });

      it('should return 400 if geometry type is missing on query filter', async function () {
        const filter = getFakeBaseFilter();
        const { geometryType, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request.query should have required property 'geometry_type'`);
      });

      it('should return 400 if layer id is missing on query filter', async function () {
        const filter = getFakeBaseFilter();
        const { layerId, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request.query should have required property 'layer_id'`);
      });

      it('should return 404 if no replica was found based on the query filter', async function () {
        await replicaRepository.clear();
        const filter = getFakeBaseFilter();
        const { replicaType, geometryType, layerId } = filter;
        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty(
          'message',
          `replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`
        );
      });

      it('should return 404 if no latest replica was found due to the replica being hidden', async function () {
        await replicaRepository.clear();
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        const { replicaId, bucketName, replicaType, geometryType, layerId } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        const filter = getFakeBaseFilter({ replicaType, geometryType, layerId });

        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty(
          'message',
          `replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`
        );
      });
    });

    describe('POST /replica', function () {
      it.each([
        [getFakeReplica({ replicaId: faker.random.word() }), `request.body.replicaId should match format "uuid"`],
        [
          getFakeReplica({ replicaType: faker.random.word() as ReplicaType }),
          `request.body.replicaType should be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          getFakeReplica({ geometryType: faker.random.word() as GeometryType }),
          `request.body.geometryType should be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [getFakeReplica({ layerId: (faker.random.word() as unknown) as number }), `request.body.layerId should be number`],
        [getFakeReplica({ timestamp: faker.random.word() }), `request.body.timestamp should match format "date-time"`],
        [
          getFakeReplica({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT - 1 }) }),
          `request.body.bucketName should NOT be shorter than ${BUCKET_NAME_MIN_LENGTH_LIMIT} characters`,
        ],
        [
          getFakeReplica({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MAX_LENGTH_LIMIT + 1 }) }),
          `request.body.bucketName should NOT be longer than ${BUCKET_NAME_MAX_LENGTH_LIMIT} characters`,
        ],
      ])('should return 400 status code if replica body has an invalid parameter', async function (replica: StringifiedReplica, bodyMessage: string) {
        const response = await requestSender.postReplica(replica);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', bodyMessage);
      });

      it('should return 409 if the replica already exists', async function () {
        const replica = getFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postReplica(replica);

        expect(response).toHaveProperty('status', httpStatusCodes.CONFLICT);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`replica with id ${replica.replicaId} already exists`);
      });
    });

    describe('POST /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const response = await requestSender.postFile(faker.random.word(), faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.BAD_REQUEST);
        const message = (response.body as { message: string }).message;
        expect(message).toContain('request.params.replicaId should match format "uuid"');
      });

      it('should return 400 status code if the file id is not valid', async function () {
        const response = await requestSender.postFile(faker.datatype.uuid(), faker.random.word());

        expect(response).toHaveProperty('status', httpStatusCodes.BAD_REQUEST);
        const message = (response.body as { message: string }).message;
        expect(message).toContain('request.body.fileId should match format "uuid"');
      });

      it('should return 404 status code if the requested replica id does not exist', async function () {
        const fakeFileId = faker.datatype.uuid();
        const response = await requestSender.postFile(fakeFileId, faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.NOT_FOUND);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`replica with id ${fakeFileId} was not found`);
      });

      it('should return 409 status code if the file to be created already exists', async function () {
        const replica = getFakeReplica();
        const fileId = faker.datatype.uuid();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replica.replicaId, fileId)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postFile(replica.replicaId, fileId);

        expect(response).toHaveProperty('status', httpStatusCodes.CONFLICT);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`file with id ${fileId} already exists`);
      });
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const response = await requestSender.deleteReplica(faker.random.word());

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.replicaId should match format "uuid"');
      });

      it('should return 404 status code if the requested replica id does not exist', async function () {
        const fakeReplicaId = faker.datatype.uuid();
        const response = await requestSender.deleteReplica(fakeReplicaId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeReplicaId} was not found`);
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const replicaUpdate = getFakeReplicaUpdate();
        const response = await requestSender.patchReplica(faker.random.word(), replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.replicaId should match format "uuid"');
      });

      it.each([
        [
          getFakeReplicaUpdate({ replicaType: faker.random.word() as ReplicaType }),
          `request.body.replicaType should be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          getFakeReplicaUpdate({ geometryType: faker.random.word() as GeometryType }),
          `request.body.geometryType should be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [getFakeReplicaUpdate({ isHidden: (faker.random.word() as unknown) as boolean }), `request.body.isHidden should be boolean`],
        [getFakeReplicaUpdate({ layerId: (faker.random.word() as unknown) as number }), `request.body.layerId should be number`],
        [getFakeReplicaUpdate({ timestamp: faker.random.word() }), `request.body.timestamp should match format "date-time"`],
        [
          getFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT - 1 }) }),
          `request.body.bucketName should NOT be shorter than ${BUCKET_NAME_MIN_LENGTH_LIMIT} characters`,
        ],
        [
          getFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MAX_LENGTH_LIMIT + 1 }) }),
          `request.body.bucketName should NOT be longer than ${BUCKET_NAME_MAX_LENGTH_LIMIT} characters`,
        ],
      ])(
        'should return 400 status code if update replica body has an invalid parameter',
        async function (replicaUpdate: StringifiedReplicaUpdate, bodyMessage: string) {
          const response = await requestSender.patchReplica(faker.datatype.uuid(), replicaUpdate);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );

      it('should return 404 status code if the requested replica id does not exist', async function () {
        const replicaUpdate = getFakeReplicaUpdate();
        const fakeReplicaId = faker.datatype.uuid();
        const response = await requestSender.patchReplica(fakeReplicaId, replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeReplicaId} was not found`);
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const findOneReplicaWithFilesMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { findOneReplicaWithFiles: findOneReplicaWithFilesMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.getReplicaById(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('GET /replica/latest', function () {
      it('should return 500 if the db throws an error', async function () {
        const findLatestReplicaWithFilesMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { findLatestReplicaWithFiles: findLatestReplicaWithFilesMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.getLatestReplica(getFakeBaseFilter());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /replica', function () {
      it('should return 500 if the db throws an error', async function () {
        const createReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const findOneReplicaMock = jest.fn().mockResolvedValue(false);
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { createReplica: createReplicaMock, findOneReplica: findOneReplicaMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.postReplica(getFakeReplica());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const createFileOnReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const findOneReplicaMock = jest.fn().mockResolvedValue(true);
        const findOneFileMock = jest.fn().mockResolvedValue(false);
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { findOneReplica: findOneReplicaMock } },
        });
        mockRegisterOptions.override.push({
          token: FILE_REPOSITORY_SYMBOL,
          provider: { useValue: { findOneFile: findOneFileMock, createFileOnReplica: createFileOnReplicaMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.postFile(faker.datatype.uuid(), faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const deleteOneReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { deleteOneReplica: deleteOneReplicaMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.deleteReplica(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const updateOneReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const findOneReplicaMock = jest.fn().mockResolvedValue(true);
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push({
          token: REPLICA_REPOSITORY_SYMBOL,
          provider: { useValue: { updateOneReplica: updateOneReplicaMock, findOneReplica: findOneReplicaMock } },
        });
        const mockApp = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);

        const response = await mockReplicaRequestSender.patchReplica(faker.datatype.uuid(), getFakeReplicaUpdate());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });
  });
});
