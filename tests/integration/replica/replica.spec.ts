import httpStatusCodes, { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { Connection, QueryFailedError } from 'typeorm';
import faker from 'faker';
import { getApp } from '../../../src/app';
import { convertReplicaToUrls, getBaseRegisterOptions, getMockObjectStorageConfig } from '../helpers';
import { Services } from '../../../src/common/constants';
import { REPLICA_REPOSITORY_SYMBOL } from '../../../src/replica/DAL/IReplicaRepository';
import { ReplicaRequestSender } from './helpers/requestSender';
import { getFakeReplica } from './helpers/generators';

describe('replica', function () {
  let requestSender: ReplicaRequestSender;
  let mockReplicaRequestSender: ReplicaRequestSender;

  beforeAll(async function () {
    const registerOptions = getBaseRegisterOptions();
    registerOptions.override.push({ token: Services.OBJECT_STORAGE, provider: { useValue: getMockObjectStorageConfig() } });
    const app = await getApp(registerOptions);
    requestSender = new ReplicaRequestSender(app);
  });
  afterAll(async function () {
    const connection = container.resolve(Connection);
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
        // expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
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
    });
  });

  describe('Bad Path', function () {
    it('should return 400 if the replicaId is not valid', async function () {
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

    it('should return 404 if the replica with the given replicaId is hidden', async function () {
      const replica = getFakeReplica();
      expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.OK);
      const { replicaId } = replica;

      const response = await requestSender.getReplicaById(replicaId);

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response.body).toHaveProperty('message', `replica with id ${replicaId} was not found`);
    });
  });

  describe('Sad Path', function () {
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
});
