import faker from 'faker';
import jsLogger from '@map-colonies/js-logger';
import { ReplicaManager } from '../../../../src/replica/models/replicaManager';
import {
  generateFakeBaseFilter,
  generateFakePrivateFilter,
  generateFakeReplica,
  generateFakeReplicaUpdate,
  generateFakeReplicaWithFiles,
  generateMockObjectStorageConfig,
  convertReplicaToResponse,
  generateFakePublicFilter,
} from '../../../helpers/helper';
import { FileAlreadyExistsError, ReplicaAlreadyExistsError, ReplicaNotFoundError } from '../../../../src/replica/models/errors';
import { ReplicaRepository } from '../../../../src/replica/DAL/typeorm/replicaRepository';
import { FileRepository } from '../../../../src/replica/DAL/typeorm/fileRepository';

let replicaManager: ReplicaManager;
let replicaManagerWithProjectId: ReplicaManager;

describe('ReplicaManager', () => {
  let findOneReplicaMock: jest.Mock;
  let findOneReplicaWithFilesMock: jest.Mock;
  let findReplicasMock: jest.Mock;
  let findLatestReplicaWithFilesMock: jest.Mock;
  let createReplicaMock: jest.Mock;
  let updateOneReplicaMock: jest.Mock;
  let updateReplicasMock: jest.Mock;
  let deleteOneReplicaMock: jest.Mock;
  let deleteReplicasMock: jest.Mock;

  let findOneFileMock: jest.Mock;
  let createFileOnReplicaMock: jest.Mock;

  beforeAll(function () {
    findOneReplicaMock = jest.fn();
    findOneReplicaWithFilesMock = jest.fn();
    findReplicasMock = jest.fn();
    findLatestReplicaWithFilesMock = jest.fn();
    createReplicaMock = jest.fn();
    updateOneReplicaMock = jest.fn();
    updateReplicasMock = jest.fn();
    deleteOneReplicaMock = jest.fn();
    deleteReplicasMock = jest.fn();
    findOneFileMock = jest.fn();
    createFileOnReplicaMock = jest.fn();
    const replicaRepository: ReplicaRepository = {
      findOneReplica: findOneReplicaMock,
      findOneReplicaWithFiles: findOneReplicaWithFilesMock,
      findReplicas: findReplicasMock,
      findLatestReplicaWithFiles: findLatestReplicaWithFilesMock,
      createReplica: createReplicaMock,
      updateOneReplica: updateOneReplicaMock,
      updateReplicas: updateReplicasMock,
      deleteOneReplica: deleteOneReplicaMock,
      deleteReplicas: deleteReplicasMock,
    } as unknown as ReplicaRepository;
    const fileRepository: FileRepository = { findOneFile: findOneFileMock, createFileOnReplica: createFileOnReplicaMock } as unknown as FileRepository;
    replicaManager = new ReplicaManager(replicaRepository, fileRepository, jsLogger({ enabled: false }), generateMockObjectStorageConfig());
    replicaManagerWithProjectId = new ReplicaManager(
      replicaRepository,
      fileRepository,
      jsLogger({ enabled: false }),
      generateMockObjectStorageConfig(true)
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('#getReplicas', () => {
    it('return an empty array if there are no existing replicas', async function () {
      findReplicasMock.mockReturnValue([]);
      const getReplicasPromise = replicaManager.getReplicas(generateFakeBaseFilter());

      await expect(getReplicasPromise).resolves.not.toThrow();
      await expect(getReplicasPromise).resolves.toMatchObject([]);
    });

    it('return replica response array matching the filter returned urls are without project id', async function () {
      const filter = generateFakePublicFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica: replica1, fileIds: fileIds1 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId, amount: 0 });
      const { replica: replica2, fileIds: fileIds2 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId });
      const replicas = [replica1, replica2];
      const { files: files1, ...rest1 } = replica1;
      const { files: files2, ...rest2 } = replica2;
      findReplicasMock.mockReturnValue(replicas);
      const expectedResponse = [convertReplicaToResponse(rest1, fileIds1), convertReplicaToResponse(rest2, fileIds2)];
      const { to, exclusiveFrom, ...restOfFilter } = filter;

      const getReplicasPromise = replicaManager.getReplicas(restOfFilter);

      await expect(getReplicasPromise).resolves.toMatchObject(expectedResponse);
    });

    it('return replica response array matching the filter returned urls are with project id', async function () {
      const filter = generateFakePublicFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica: replica1, fileIds: fileIds1 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId, amount: 0 });
      const { replica: replica2, fileIds: fileIds2 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId });
      const replicas = [replica1, replica2];
      const { files: files1, ...rest1 } = replica1;
      const { files: files2, ...rest2 } = replica2;
      findReplicasMock.mockReturnValue(replicas);
      const expectedResponse = [convertReplicaToResponse(rest1, fileIds1, true), convertReplicaToResponse(rest2, fileIds2, true)];
      const { to, exclusiveFrom, ...restOfFilter } = filter;

      const getReplicasPromise = replicaManagerWithProjectId.getReplicas(restOfFilter);

      await expect(getReplicasPromise).resolves.toMatchObject(expectedResponse);
    });
  });

  describe('#getReplicaById', () => {
    it('resolves with the replica with given id that has no files', async function () {
      const { replica } = generateFakeReplicaWithFiles({ amount: 0 });
      findOneReplicaWithFilesMock.mockReturnValue(replica);

      const getReplicaByIdPromise = replicaManager.getReplicaById(replica.replicaId);

      const { files, ...rest } = replica;
      await expect(getReplicaByIdPromise).resolves.toMatchObject(convertReplicaToResponse(rest));
    });

    it('resolves with the replica with given id and its files', async function () {
      const { replica, fileIds } = generateFakeReplicaWithFiles();
      findOneReplicaWithFilesMock.mockReturnValue(replica);

      const getReplicaByIdPromise = replicaManager.getReplicaById(replica.replicaId);

      const { files, ...rest } = replica;
      await expect(getReplicaByIdPromise).resolves.toMatchObject(convertReplicaToResponse(rest, fileIds));
    });

    it('rejects if the replica with the given id does not exist', async function () {
      findOneReplicaWithFilesMock.mockReturnValue(null);

      const getReplicaByIdPromise = replicaManager.getReplicaById(faker.datatype.uuid());

      await expect(getReplicaByIdPromise).rejects.toThrow(ReplicaNotFoundError);
    });
  });

  describe('#getLatestReplica', () => {
    it('resolves with the latest replica matching filter', async function () {
      const filter = generateFakeBaseFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica, fileIds } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId });
      findLatestReplicaWithFilesMock.mockReturnValue(replica);

      const getLatestReplicaPromise = replicaManager.getLatestReplica(filter);

      const { files, ...rest } = replica;
      await expect(getLatestReplicaPromise).resolves.toMatchObject(convertReplicaToResponse(rest, fileIds));
    });

    it('resolves with the replica with given id and its files', async function () {
      const filter = generateFakeBaseFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica, fileIds } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId, amount: 0 });
      findLatestReplicaWithFilesMock.mockReturnValue(replica);

      const getLatestReplicaPromise = replicaManager.getLatestReplica(replica);

      const { files, ...rest } = replica;
      await expect(getLatestReplicaPromise).resolves.toMatchObject(convertReplicaToResponse(rest, fileIds));
    });

    it('rejects if the replica with the given id does not exist', async function () {
      findLatestReplicaWithFilesMock.mockResolvedValue(null);

      const getLatestReplicaPromise = replicaManager.getLatestReplica(generateFakeBaseFilter());

      await expect(getLatestReplicaPromise).rejects.toThrow(ReplicaNotFoundError);
    });
  });

  describe('#createReplica', () => {
    it('resolves without errors if the replica id does not already exists', async function () {
      findOneReplicaMock.mockResolvedValue(null);
      createReplicaMock.mockReturnValue(null);
      const replica = generateFakeReplica();
      const { timestamp, ...rest } = replica;

      const createReplicaPromise = replicaManager.createReplica({ ...rest, timestamp: new Date(timestamp) });

      await expect(createReplicaPromise).resolves.not.toThrow();
    });

    it('rejects if the replica with the given id already exists', async function () {
      const replica = generateFakeReplica();
      const { timestamp, ...rest } = replica;
      findOneReplicaMock.mockResolvedValue(replica);

      const createReplicaPromise = replicaManager.createReplica({ ...rest, timestamp: new Date(timestamp) });

      await expect(createReplicaPromise).rejects.toThrow(ReplicaAlreadyExistsError);
    });
  });

  describe('#createFileOnReplica', () => {
    it('resolves without errors if the file id does not already exists', async function () {
      const replica = generateFakeReplica();
      findOneReplicaMock.mockResolvedValue(replica);
      findOneFileMock.mockResolvedValue(null);
      createFileOnReplicaMock.mockReturnValue(null);

      const createFileOnReplicaPromise = replicaManager.createFileOnReplica(replica.replicaId, faker.datatype.uuid());

      await expect(createFileOnReplicaPromise).resolves.not.toThrow();
    });

    it('rejects if the replica with the given id does not exist', async function () {
      const replica = generateFakeReplica();
      findOneReplicaMock.mockResolvedValue(null);

      const createFileOnReplicaPromise = replicaManager.createFileOnReplica(replica.replicaId, faker.datatype.uuid());

      await expect(createFileOnReplicaPromise).rejects.toThrow(ReplicaNotFoundError);
    });

    it('rejects if the file id given already exists on the replica', async function () {
      const replica = generateFakeReplica();
      const file = { replicaId: replica.replicaId, fileId: faker.datatype.uuid() };
      findOneReplicaMock.mockResolvedValue(replica);
      findOneFileMock.mockResolvedValue(file);

      const createFileOnReplicaPromise = replicaManager.createFileOnReplica(replica.replicaId, file.fileId);

      await expect(createFileOnReplicaPromise).rejects.toThrow(FileAlreadyExistsError);
    });
  });

  describe('#updateReplica', () => {
    it('resolves without errors if the replica id already exists', async function () {
      const replica = generateFakeReplica();
      findOneReplicaMock.mockResolvedValue(replica);

      const updateReplicaPromise = replicaManager.updateReplica(replica.replicaId, {});

      await expect(updateReplicaPromise).resolves.not.toThrow();
    });

    it('rejects if the replica with the given id does not exist', async function () {
      findOneReplicaMock.mockResolvedValue(null);

      const updateReplicaPromise = replicaManager.updateReplica(faker.datatype.uuid(), {});

      await expect(updateReplicaPromise).rejects.toThrow(ReplicaNotFoundError);
    });
  });

  describe('#updateReplicas', () => {
    it("resolves without errors if either there are or aren't replicas matching the filter", async function () {
      updateReplicasMock.mockResolvedValue(undefined);
      const { exclusiveFrom, to, ...restOfFilter } = generateFakePrivateFilter();
      const { timestamp, ...restOfUpdateBoby } = generateFakeReplicaUpdate();

      const updateReplicasPromise = replicaManager.updateReplicas({ ...restOfFilter }, restOfUpdateBoby);

      await expect(updateReplicasPromise).resolves.not.toThrow();
    });
  });

  describe('#deleteReplica', () => {
    it('resolves without errors if the replica id already exists and returns the deleted replica', async function () {
      const { replica } = generateFakeReplicaWithFiles({ amount: 0 });
      deleteOneReplicaMock.mockResolvedValue(replica);
      const { files, ...rest } = replica;

      const deleteReplicaPromise = replicaManager.deleteReplica(replica.replicaId);

      await expect(deleteReplicaPromise).resolves.toMatchObject(convertReplicaToResponse(rest));
    });

    it('resolves without errors if the replica id already exists and returns the deleted replica and its files', async function () {
      const filter = generateFakeBaseFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica, fileIds } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId });
      deleteOneReplicaMock.mockReturnValue(replica);
      const { files, ...rest } = replica;

      const deleteReplicaPromise = replicaManager.deleteReplica(replica.replicaId);

      await expect(deleteReplicaPromise).resolves.toMatchObject(convertReplicaToResponse(rest, fileIds));
    });

    it('rejects if the replica with the given id does not exist', async function () {
      deleteOneReplicaMock.mockResolvedValue(null);

      const deleteReplicaPromise = replicaManager.deleteReplica(faker.datatype.uuid());

      await expect(deleteReplicaPromise).rejects.toThrow(ReplicaNotFoundError);
    });
  });

  describe('#deleteReplicas', () => {
    it('resolves without errors and returns all deleted replicas and its files', async function () {
      const filter = generateFakeBaseFilter();
      const { replicaType, geometryType, layerId } = filter;
      const { replica: replica1, fileIds: fileIds1 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId, amount: 0 });
      const { replica: replica2, fileIds: fileIds2 } = generateFakeReplicaWithFiles({ replicaType, geometryType, layerId });
      const replicas = [replica1, replica2];
      const { files: files1, ...rest1 } = replica1;
      const { files: files2, ...rest2 } = replica2;
      deleteReplicasMock.mockReturnValue(replicas);
      const expectedResponse = [convertReplicaToResponse(rest1, fileIds1), convertReplicaToResponse(rest2, fileIds2)];

      const deleteReplicasPromise = replicaManager.deleteReplicas(filter);

      await expect(deleteReplicasPromise).resolves.toMatchObject(expectedResponse);
    });

    it('resolves without errors if the delete filter does not match any replicas', async function () {
      const { exclusiveFrom, to, ...restOfFilter } = generateFakePrivateFilter();
      deleteReplicasMock.mockResolvedValue([]);

      const deleteReplicasPromise = replicaManager.deleteReplicas(restOfFilter);

      await expect(deleteReplicasPromise).resolves.toMatchObject([]);
    });
  });
});
