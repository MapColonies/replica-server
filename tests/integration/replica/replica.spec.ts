/* eslint-disable @typescript-eslint/no-unused-vars */
import config from 'config';
import httpStatusCodes, { StatusCodes } from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { DataSource, QueryFailedError } from 'typeorm';
import { faker } from '@faker-js/faker';
import { Application } from 'express';
import { getApp } from '../../../src/app';
import {
  BEFORE_ALL_TIMEOUT,
  BOTTOM_FROM,
  createFakeDateBetweenBottomAndTop,
  FLOW_TEST_TIMEOUT,
  getBaseRegisterOptions,
  sortByOrderFilter,
  TOP_TO,
} from '../helpers';
import { BUCKET_NAME_MAX_LENGTH_LIMIT, BUCKET_NAME_MIN_LENGTH_LIMIT, SERVICES } from '../../../src/common/constants';
import { DATA_SOURCE_PROVIDER } from '../../../src/common/db';
import { GeometryType, ReplicaType } from '../../../src/common/enums';
import { DbConfig } from '../../../src/common/interfaces';
import { BaseReplicaFilter } from '../../../src/replica/models/replicaFilter';
import { SortFilter } from '../../../src/common/types';
import { Replica } from '../../../src/replica/DAL/typeorm/replica';
import { initConnection } from '../../../src/common/db';
import {
  generateFakeBaseFilter,
  generateFakePrivateFilter,
  generateFakePublicFilter,
  generateFakeReplica,
  generateFakeReplicaUpdate,
  generateMockObjectStorageConfig,
  StringifiedReplica,
  StringifiedReplicaUpdate,
  convertReplicaToResponse,
  convertReplicaToUrls,
} from '../../helpers/helper';
import { FILE_CUSTOM_REPOSITORY_SYMBOL } from '../../../src/replica/DAL/typeorm/fileRepository';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL } from '../../../src/replica/DAL/typeorm/replicaRepository';
import { ReplicaRequestSender } from './helpers/requestSender';

describe('replica', function () {
  let app: Application;
  let container: DependencyContainer;
  let connection: DataSource;
  let requestSender: ReplicaRequestSender;
  let mockReplicaRequestSender: ReplicaRequestSender;

  beforeAll(async function () {
    const dataSourceOptions = config.get<DbConfig>('db');
    connection = await initConnection(dataSourceOptions);
    const replicaRepository = connection.getRepository(Replica);
    await replicaRepository.delete({});

    const registerOptions = getBaseRegisterOptions();
    registerOptions.override.push(
      { token: DATA_SOURCE_PROVIDER, provider: { useValue: connection } },
      { token: SERVICES.OBJECT_STORAGE, provider: { useValue: generateMockObjectStorageConfig() } }
    );

    [container, app] = await getApp(registerOptions);
    requestSender = new ReplicaRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async function () {
    await connection.destroy();
    container.reset();
  });

  describe('Happy Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 200 status code and the requested replica', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);

        const response = await requestSender.getReplicaById(replicaId);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });

      it('should return 200 status code and the requested replica with its files', async function () {
        const replica = generateFakeReplica();
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

      it(
        'should return 200 status code and the requested replica with its files when projectId is configured',
        async function () {
          const replica = generateFakeReplica();
          const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
          expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
          const { replicaId, bucketName, ...restOfMetadata } = replica;
          expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
          expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
          expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);

          const mockRegisterOptions = getBaseRegisterOptions();
          mockRegisterOptions.override.push({ token: SERVICES.OBJECT_STORAGE, provider: { useValue: generateMockObjectStorageConfig(true) } });
          const [, mockApp] = await getApp(mockRegisterOptions);
          mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
          const response = await mockReplicaRequestSender.getReplicaById(replicaId);

          const urls = convertReplicaToUrls(replica, fileIds, true);

          expect(response.status).toBe(httpStatusCodes.OK);
          expect(response.body).toMatchObject({ ...restOfMetadata, urls });
        },
        FLOW_TEST_TIMEOUT
      );
    });

    describe('GET /replica/latest', function () {
      it('should return 200 status code and the latest replica according to filter', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const { replicaType, geometryType, layerId } = replica;
        const filter = generateFakeBaseFilter({ replicaType, geometryType, layerId });

        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });

      it('should return 200 status code and the latest replica with its files according to filter', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        const { replicaId, bucketName, ...restOfMetadata } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const { replicaType, geometryType, layerId } = replica;
        const filter = generateFakeBaseFilter({ replicaType, geometryType, layerId });

        const response = await requestSender.getLatestReplica(filter);

        const urls = convertReplicaToUrls(replica, fileIds);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: urls });
      });
    });

    describe('GET /replica', function () {
      it('should return 200 status code and empty array of replicas when there are none matching the filter', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const { replicaId, layerId } = replica;
        expect(await requestSender.patchReplica(replicaId, { isHidden: false })).toHaveStatus(StatusCodes.OK);
        const filter = generateFakeBaseFilter({ layerId: layerId + 1 });

        const response = await requestSender.getReplicas(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([]);
      });

      it('should return 200 status code and the matching replicas according to filter with default sort', async function () {
        const filter = generateFakeBaseFilter();
        const { geometryType, replicaType, layerId } = filter;
        const replica1 = generateFakeReplica({ geometryType, replicaType, layerId });
        const replica2 = generateFakeReplica({ geometryType, replicaType, layerId: layerId + 1 });
        const replica3 = generateFakeReplica({ geometryType, replicaType, layerId });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplicas({ isHidden: true, layerId, geometryType, replicaType }, { isHidden: false })).toHaveStatus(
          StatusCodes.OK
        );
        expect(
          await requestSender.patchReplicas({ isHidden: true, layerId: layerId + 1, geometryType, replicaType }, { isHidden: false })
        ).toHaveStatus(StatusCodes.OK);
        const expectedResponse = sortByOrderFilter([convertReplicaToResponse(replica1), convertReplicaToResponse(replica3)]);

        const response = await requestSender.getReplicas(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(expectedResponse);
      });

      it('should return 200 status code and the matching replicas according to filter with ascending sort', async function () {
        const filter = generateFakePublicFilter({ sort: 'asc' });
        const { geometryType, replicaType, layerId } = filter;
        const replica1 = generateFakeReplica({ geometryType, replicaType, layerId });
        const replica2 = generateFakeReplica({ geometryType, replicaType, layerId: layerId + 1 });
        const replica3 = generateFakeReplica({ geometryType, replicaType, layerId });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplicas({ isHidden: true, layerId, geometryType, replicaType }, { isHidden: false })).toHaveStatus(
          StatusCodes.OK
        );
        expect(
          await requestSender.patchReplicas({ isHidden: true, layerId: layerId + 1, geometryType, replicaType }, { isHidden: false })
        ).toHaveStatus(StatusCodes.OK);
        const expectedResponse = sortByOrderFilter([convertReplicaToResponse(replica1), convertReplicaToResponse(replica3)], 'asc');

        const response = await requestSender.getReplicas(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(expectedResponse);
      });

      it.each([
        [
          BOTTOM_FROM.toISOString(),
          TOP_TO.toISOString(),
          createFakeDateBetweenBottomAndTop().toISOString(),
          faker.date.past(undefined, BOTTOM_FROM).toISOString(),
        ],
        [
          BOTTOM_FROM.toISOString(),
          undefined,
          createFakeDateBetweenBottomAndTop().toISOString(),
          faker.date.past(undefined, BOTTOM_FROM).toISOString(),
        ],
        [undefined, TOP_TO.toISOString(), createFakeDateBetweenBottomAndTop().toISOString(), faker.date.future(undefined, BOTTOM_FROM).toISOString()],
        [BOTTOM_FROM.toISOString(), TOP_TO.toISOString(), TOP_TO.toISOString(), BOTTOM_FROM.toISOString()],
      ])(
        'should return 200 status code and the matching replicas according to time filter',
        async function (exclusiveFrom: string | undefined, to: string | undefined, matchedDate: string, unmatchedDate: string) {
          const filter = generateFakePublicFilter({ exclusiveFrom, to });
          const { geometryType, replicaType, layerId } = filter;
          const replica1 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: matchedDate });
          const replica2 = generateFakeReplica({ geometryType, replicaType, layerId: layerId + 1, timestamp: unmatchedDate });
          const replica3 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: matchedDate });
          expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
          expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
          expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);
          expect(await requestSender.patchReplicas({ isHidden: true, layerId, geometryType, replicaType }, { isHidden: false })).toHaveStatus(
            StatusCodes.OK
          );
          expect(
            await requestSender.patchReplicas({ isHidden: true, layerId: layerId + 1, geometryType, replicaType }, { isHidden: false })
          ).toHaveStatus(StatusCodes.OK);
          const expectedResponse = sortByOrderFilter([convertReplicaToResponse(replica1), convertReplicaToResponse(replica3)]);

          const response = await requestSender.getReplicas(filter);

          expect(response.status).toBe(httpStatusCodes.OK);
          expect(response.body).toMatchObject(expectedResponse);
        }
      );

      it('should return 200 status code and an empty array of replicas when timestamp to filter is prior to from filter', async function () {
        const filter = generateFakePublicFilter({ exclusiveFrom: TOP_TO.toISOString(), to: BOTTOM_FROM.toISOString() });
        const { geometryType, replicaType, layerId } = filter;
        const fakeTimestamp = createFakeDateBetweenBottomAndTop().toISOString();
        const replica1 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakeTimestamp });
        const replica2 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakeTimestamp });
        const replica3 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakeTimestamp });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplicas({ isHidden: true, geometryType, replicaType, layerId }, { isHidden: false })).toHaveStatus(
          StatusCodes.OK
        );

        const response = await requestSender.getReplicas(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([]);
      });

      it('should return 200 status code and an empty array of replicas if no replica matched the timestamp filter', async function () {
        const filter = generateFakePublicFilter({ exclusiveFrom: TOP_TO.toISOString(), to: BOTTOM_FROM.toISOString() });
        const { geometryType, replicaType, layerId } = filter;
        const fakeFutureTimestamp = faker.date.future(undefined, TOP_TO).toISOString();
        const fakePastTimestamp = faker.date.past(undefined, BOTTOM_FROM).toISOString();
        const replica1 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakeFutureTimestamp });
        const replica2 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakePastTimestamp });
        const replica3 = generateFakeReplica({ geometryType, replicaType, layerId, timestamp: fakeFutureTimestamp });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.patchReplicas({ isHidden: true, geometryType, replicaType, layerId }, { isHidden: false })).toHaveStatus(
          StatusCodes.OK
        );

        const response = await requestSender.getReplicas(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([]);
      });
    });

    describe('POST /replica/{replicaId}', function () {
      it('should return 201 status code for creating a new file on replica', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postFile(replica.replicaId, faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.CREATED);
      });
    });

    describe('POST /replica', function () {
      it('should return 201 status code for creating a new replica', async function () {
        const replica = generateFakeReplica();
        const response = await requestSender.postReplica(replica);

        expect(response).toHaveProperty('status', httpStatusCodes.CREATED);
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 200 status code for updating a replica', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const replicaUpdate = generateFakeReplicaUpdate();

        const response = await requestSender.patchReplica(replica.replicaId, replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.OK);
      });
    });

    describe('PATCH /replica', function () {
      it('should return 200 status code and update all, some or none matching replicas according to filter', async function () {
        const filter = generateFakePublicFilter({ replicaType: ReplicaType.SNAPSHOT });
        const { replicaType, geometryType, layerId } = filter;
        const updatedLayerId = layerId + 1;
        const replica1 = generateFakeReplica({ replicaType, geometryType, layerId });
        const replica2 = generateFakeReplica({ replicaType, geometryType, layerId: updatedLayerId });
        const replica3 = generateFakeReplica({ replicaType, geometryType, layerId });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);

        // update replicas 1 and 3 to have updated layer id and hidden false
        const firstPatchResponse = await requestSender.patchReplicas({ layerId }, { isHidden: false, layerId: updatedLayerId });

        expect(firstPatchResponse.status).toBe(httpStatusCodes.OK);

        // get all replicas with updated layer id (who are not hidden)
        replica1.layerId = updatedLayerId;
        replica3.layerId = updatedLayerId;
        let expectedGetResponse = sortByOrderFilter([convertReplicaToResponse(replica1), convertReplicaToResponse(replica3)]);
        const firstGetResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: updatedLayerId });
        expect(firstGetResponse.body).toMatchObject(expectedGetResponse);

        // update all replicas with updated layer id to not be hidden (only replica 2)
        const secondPatchResponse = await requestSender.patchReplicas({ layerId: updatedLayerId }, { isHidden: false });

        expect(secondPatchResponse.status).toBe(httpStatusCodes.OK);

        // get all 3 replicas who are now visible
        expectedGetResponse = sortByOrderFilter([
          convertReplicaToResponse(replica1),
          convertReplicaToResponse(replica2),
          convertReplicaToResponse(replica3),
        ]);
        const secondGetResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: updatedLayerId });
        expect(secondGetResponse.body).toMatchObject(expectedGetResponse);

        // update all replicas with the old layer id to have some property (there are none)
        const thirdPatchResponse = await requestSender.patchReplicas({ layerId: layerId }, { replicaType: ReplicaType.DELTA });
        expect(thirdPatchResponse.status).toBe(httpStatusCodes.OK);

        // validate none where updated and still got ok
        const thirdGetResponse = await requestSender.getReplicas({ replicaType: ReplicaType.DELTA, geometryType, layerId: layerId });
        expect(thirdGetResponse.body).toMatchObject([]);

        // update all replicas with updated layer id to have replica type of delta instead of snapshot
        const fourthPatchResponse = await requestSender.patchReplicas({ layerId: updatedLayerId }, { replicaType: ReplicaType.DELTA });
        expect(fourthPatchResponse.status).toBe(httpStatusCodes.OK);

        // get all three replicas with updated layer id and updated replica type
        replica1.replicaType = ReplicaType.DELTA;
        replica2.replicaType = ReplicaType.DELTA;
        replica3.replicaType = ReplicaType.DELTA;
        expectedGetResponse = sortByOrderFilter([
          convertReplicaToResponse(replica1),
          convertReplicaToResponse(replica2),
          convertReplicaToResponse(replica3),
        ]);
        const fourthGetResponse = await requestSender.getReplicas({ replicaType: ReplicaType.DELTA, geometryType, layerId: updatedLayerId });
        expect(fourthGetResponse.body).toMatchObject(expectedGetResponse);
      });

      it('should return 200 status code and update all, some or none matching replicas according to time filter', async function () {
        const filter = generateFakePublicFilter({ layerId: -10, exclusiveFrom: BOTTOM_FROM.toISOString(), to: TOP_TO.toISOString() });
        const { replicaType, geometryType, layerId } = filter;
        const replica1 = generateFakeReplica({
          replicaType,
          geometryType,
          layerId,
          timestamp: faker.date.between(BOTTOM_FROM, TOP_TO).toISOString(),
        });
        const replica2 = generateFakeReplica({
          replicaType,
          geometryType,
          layerId,
          timestamp: faker.date.between(BOTTOM_FROM, TOP_TO).toISOString(),
        });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);

        // filter between timestamps
        let response = await requestSender.patchReplicas(filter, { isHidden: false, layerId: -12 });
        expect(response.status).toBe(httpStatusCodes.OK);

        // so we'll get both with new layer id
        replica1.layerId = -12;
        replica2.layerId = -12;
        const expectedGetResponse = sortByOrderFilter([convertReplicaToResponse(replica1), convertReplicaToResponse(replica2)]);
        const getResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: -12 });
        expect(getResponse.body).toMatchObject(expectedGetResponse);

        // so we'll match the earlier replica of the two
        filter.to = faker.date.between(expectedGetResponse[1].timestamp, expectedGetResponse[0].timestamp).toISOString();
        filter.exclusiveFrom = undefined;

        // filter timestamp earlier then to
        response = await requestSender.patchReplicas({ ...filter, layerId: -12 }, { layerId: -13 });
        expect(response.status).toBe(httpStatusCodes.OK);

        // get the earlier with new layer id
        expectedGetResponse[1].layerId = -13;
        const secondGetResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: -13 });
        expect(secondGetResponse.body).toMatchObject([expectedGetResponse[1]]);

        // filter timestamp from the middle so we'll match the latter replica of the two
        filter.exclusiveFrom = filter.to;
        filter.to = undefined;

        response = await requestSender.patchReplicas({ ...filter, layerId: -12 }, { layerId: -13 });
        expect(response.status).toBe(httpStatusCodes.OK);

        // get the latter with new layer id
        expectedGetResponse[0].layerId = -13;
        const thirdGetResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: -13 });
        expect(thirdGetResponse.body).toMatchObject(expectedGetResponse);

        // so we won't match any of the two
        filter.to = filter.exclusiveFrom;
        filter.exclusiveFrom = expectedGetResponse[1].timestamp;

        response = await requestSender.patchReplicas({ ...filter }, { layerId: -14 });
        expect(response.status).toBe(httpStatusCodes.OK);

        // get none
        const fourthGetResponse = await requestSender.getReplicas({ replicaType, geometryType, layerId: -14 });
        expect(fourthGetResponse.body).toMatchObject([]);
      });
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 200 status code for deleting a replica and all its files and return the full replica as body', async function () {
        const replica = generateFakeReplica();
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
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.deleteReplica(replica.replicaId);

        const { replicaId, bucketName, ...restOfMetadata } = replica;

        expect(response).toHaveProperty('status', httpStatusCodes.OK);
        expect(response.body).toMatchObject({ ...restOfMetadata, urls: [] });
      });
    });

    describe('DELETE /replica', function () {
      it('should return 200 status code and delete all, some and none matching replicas and all its files and return the fully deleted replicas as body', async function () {
        const filter = generateFakePublicFilter({ replicaType: ReplicaType.SNAPSHOT });
        const { replicaType, layerId } = filter;
        const replica1 = generateFakeReplica({ replicaType, geometryType: GeometryType.POINT, layerId });
        const replica2 = generateFakeReplica({ replicaType, geometryType: GeometryType.POINT, layerId });
        const replica3 = generateFakeReplica({ replicaType, geometryType: GeometryType.LINESTRING, layerId });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);

        const fileIds1 = [faker.datatype.uuid(), faker.datatype.uuid()];
        expect(await requestSender.postFile(replica1.replicaId, fileIds1[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replica1.replicaId, fileIds1[1])).toHaveStatus(StatusCodes.CREATED);
        const fileIds3 = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()];
        expect(await requestSender.postFile(replica3.replicaId, fileIds3[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replica3.replicaId, fileIds3[1])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replica3.replicaId, fileIds3[2])).toHaveStatus(StatusCodes.CREATED);

        // delete some replicas
        const firstDeleteResponse = await requestSender.deleteReplicas({ layerId, geometryType: GeometryType.POINT });

        expect(firstDeleteResponse.status).toBe(httpStatusCodes.OK);
        expect(firstDeleteResponse.body).toMatchObject([convertReplicaToResponse(replica1, fileIds1), convertReplicaToResponse(replica2)]);

        // delete no replicas
        const secondDeleteResponse = await requestSender.deleteReplicas({ layerId, geometryType: GeometryType.POLYGON });

        expect(secondDeleteResponse.status).toBe(httpStatusCodes.OK);
        expect(secondDeleteResponse.body).toMatchObject([]);

        // delete all replicas left, which is replica3
        const thirdDeleteResponse = await requestSender.deleteReplicas({ layerId, geometryType: GeometryType.LINESTRING });

        expect(thirdDeleteResponse.status).toBe(httpStatusCodes.OK);
        expect(thirdDeleteResponse.body).toMatchObject([convertReplicaToResponse(replica3, fileIds3)]);
      });

      it('should return 200 status code and delete all, some or none matching replicas according to time filter', async function () {
        const filter = generateFakePublicFilter({ exclusiveFrom: BOTTOM_FROM.toISOString(), to: TOP_TO.toISOString() });
        const { replicaType, geometryType, layerId } = filter;
        const replica1 = generateFakeReplica({
          replicaType,
          geometryType,
          layerId,
          timestamp: faker.date.between(BOTTOM_FROM, TOP_TO).toISOString(),
        });
        const replica2 = generateFakeReplica({
          replicaType,
          geometryType,
          layerId,
          timestamp: faker.date.between(BOTTOM_FROM, TOP_TO).toISOString(),
        });
        const replica3 = generateFakeReplica({
          replicaType,
          geometryType,
          layerId,
          timestamp: faker.date.between(BOTTOM_FROM, TOP_TO).toISOString(),
        });
        expect(await requestSender.postReplica(replica1)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica2)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postReplica(replica3)).toHaveStatus(StatusCodes.CREATED);

        // order replicas by timestamp and delete the one in between
        const orderedReplicas = sortByOrderFilter([replica1, replica2, replica3]);
        const firstFrom = faker.date.between(orderedReplicas[2].timestamp, orderedReplicas[1].timestamp);
        const firstTo = faker.date.between(orderedReplicas[1].timestamp, orderedReplicas[0].timestamp);

        const firstResponse = await requestSender.deleteReplicas({ ...filter, exclusiveFrom: firstFrom.toISOString(), to: firstTo.toISOString() });
        expect(firstResponse.status).toBe(httpStatusCodes.OK);
        expect(firstResponse.body).toMatchObject([convertReplicaToResponse(orderedReplicas[1])]);

        // delete exclusively from the earliest one, only the latter will be deleted
        const secondResponse = await requestSender.deleteReplicas({ ...filter, exclusiveFrom: orderedReplicas[2].timestamp });
        expect(secondResponse.status).toBe(httpStatusCodes.OK);
        expect(secondResponse.body).toMatchObject([convertReplicaToResponse(orderedReplicas[0])]);

        // initialize the same delete filter again, no replicas should be matched for delete
        const thirdResponse = await requestSender.deleteReplicas({ ...filter, exclusiveFrom: orderedReplicas[2].timestamp });
        expect(thirdResponse.status).toBe(httpStatusCodes.OK);
        expect(thirdResponse.body).toMatchObject([]);

        // delete all replicas to the top to, all left replicas should be deleted, meaning the earliest replica
        const fourthResponse = await requestSender.deleteReplicas({ ...filter, to: TOP_TO.toISOString() });
        expect(fourthResponse.status).toBe(httpStatusCodes.OK);
        expect(fourthResponse.body).toMatchObject([convertReplicaToResponse(orderedReplicas[2])]);
      });
    });
  });

  describe('Bad Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 400 if the replica id is not valid', async function () {
        const response = await requestSender.getReplicaById('invalidId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request/params/replicaId must match format "uuid"');
      });

      it('should return 404 if the replica with the given replicaId was not found', async function () {
        const fakeId = faker.datatype.uuid();
        const response = await requestSender.getReplicaById(fakeId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeId} was not found`);
      });

      it('should return 404 if the replica with the given replica id is hidden', async function () {
        const replica = generateFakeReplica();
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
          generateFakeBaseFilter({ replicaType: faker.random.word() as ReplicaType }),
          `request/query/replica_type must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakeBaseFilter({ geometryType: faker.random.word() as GeometryType }),
          `request/query/geometry_type must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakeBaseFilter({ layerId: faker.random.word() as unknown as number }), `request/query/layer_id must be number`],
      ])(
        'should return 400 status code if the filter has an invalid query parameter',
        async function (filter: BaseReplicaFilter, bodyMessage: string) {
          const response = await requestSender.getLatestReplica(filter);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );

      it('should return 400 if replica type is missing on query filter', async function () {
        const filter = generateFakeBaseFilter();
        const { replicaType, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'replica_type'`);
      });

      it('should return 400 if geometry type is missing on query filter', async function () {
        const filter = generateFakeBaseFilter();
        const { geometryType, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'geometry_type'`);
      });

      it('should return 400 if layer id is missing on query filter', async function () {
        const filter = generateFakeBaseFilter();
        const { layerId, ...restOfFilter } = filter;
        const response = await requestSender.getLatestReplica(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'layer_id'`);
      });

      it('should return 404 if no replica was found based on the query filter', async function () {
        const filter = generateFakeBaseFilter({ layerId: -1 });
        const { replicaType, geometryType, layerId } = filter;
        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty(
          'message',
          `replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`
        );
      });

      it('should return 404 if no latest replica was found due to the replica being hidden', async function () {
        const replica = generateFakeReplica({ layerId: -2 });
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        const fileIds = [faker.datatype.uuid(), faker.datatype.uuid()];
        const { replicaId, replicaType, geometryType, layerId } = replica;
        expect(await requestSender.postFile(replicaId, fileIds[0])).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replicaId, fileIds[1])).toHaveStatus(StatusCodes.CREATED);
        const filter = generateFakeBaseFilter({ replicaType, geometryType, layerId });

        const response = await requestSender.getLatestReplica(filter);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty(
          'message',
          `replica of type ${replicaType} with geometry type of ${geometryType} on layer ${layerId} was not found`
        );
      });
    });

    describe('GET /replica', function () {
      it.each([
        [
          generateFakePublicFilter({ replicaType: faker.random.word() as ReplicaType }),
          `request/query/replica_type must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakePublicFilter({ geometryType: faker.random.word() as GeometryType }),
          `request/query/geometry_type must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakePublicFilter({ layerId: faker.random.word() as unknown as number }), `request/query/layer_id must be number`],
        [generateFakePublicFilter({ exclusiveFrom: faker.random.word() }), `request/query/exclusive_from must match format "date-time"`],
        [generateFakePublicFilter({ to: faker.random.word() }), `request/query/to must match format "date-time"`],
        [generateFakePublicFilter({ sort: 'bad' as SortFilter }), `request/query/sort must be equal to one of the allowed values: asc, desc`],
      ])(
        'should return 400 status code if the filter has an invalid query parameter',
        async function (filter: BaseReplicaFilter, bodyMessage: string) {
          const response = await requestSender.getReplicas(filter);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );

      it('should return 400 if the filter is missing replica_type parameter', async function () {
        const filter = generateFakePublicFilter();
        const { replicaType, ...restOfFilter } = filter;
        const response = await requestSender.getReplicas(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'replica_type'`);
      });

      it('should return 400 if the filter is missing geometry_type parameter', async function () {
        const filter = generateFakePublicFilter();
        const { geometryType, ...restOfFilter } = filter;
        const response = await requestSender.getReplicas(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'geometry_type'`);
      });

      it('should return 400 if the filter is missing layer_id parameter', async function () {
        const filter = generateFakePublicFilter();
        const { layerId, ...restOfFilter } = filter;
        const response = await requestSender.getReplicas(restOfFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/query must have required property 'layer_id'`);
      });
    });

    describe('POST /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const response = await requestSender.postFile(faker.random.word(), faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.BAD_REQUEST);
        const message = (response.body as { message: string }).message;
        expect(message).toContain('request/params/replicaId must match format "uuid"');
      });

      it('should return 400 status code if the file id is not valid', async function () {
        const response = await requestSender.postFile(faker.datatype.uuid(), faker.random.word());

        expect(response).toHaveProperty('status', httpStatusCodes.BAD_REQUEST);
        const message = (response.body as { message: string }).message;
        expect(message).toContain('request/body/fileId must match format "uuid"');
      });

      it('should return 404 status code if the requested replica id does not exist', async function () {
        const fakeFileId = faker.datatype.uuid();
        const response = await requestSender.postFile(fakeFileId, faker.datatype.uuid());

        expect(response).toHaveProperty('status', httpStatusCodes.NOT_FOUND);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`replica with id ${fakeFileId} was not found`);
      });

      it('should return 409 status code if the file to be created already exists', async function () {
        const replica = generateFakeReplica();
        const fileId = faker.datatype.uuid();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);
        expect(await requestSender.postFile(replica.replicaId, fileId)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postFile(replica.replicaId, fileId);

        expect(response).toHaveProperty('status', httpStatusCodes.CONFLICT);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`file with id ${fileId} already exists`);
      });
    });

    describe('POST /replica', function () {
      it.each([
        [generateFakeReplica({ replicaId: faker.random.word() }), `request/body/replicaId must match format "uuid"`],
        [
          generateFakeReplica({ replicaType: faker.random.word() as ReplicaType }),
          `request/body/replicaType must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakeReplica({ geometryType: faker.random.word() as GeometryType }),
          `request/body/geometryType must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakeReplica({ layerId: faker.random.word() as unknown as number }), `request/body/layerId must be number`],
        [generateFakeReplica({ timestamp: faker.random.word() }), `request/body/timestamp must match format "date-time"`],
        [
          generateFakeReplica({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT - 1 }) }),
          `request/body/bucketName must NOT have fewer than ${BUCKET_NAME_MIN_LENGTH_LIMIT} characters`,
        ],
        [
          generateFakeReplica({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MAX_LENGTH_LIMIT + 1 }) }),
          `request/body/bucketName must NOT have more than ${BUCKET_NAME_MAX_LENGTH_LIMIT} characters`,
        ],
      ])('should return 400 status code if replica body has an invalid parameter', async function (replica: StringifiedReplica, bodyMessage: string) {
        const response = await requestSender.postReplica(replica);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', bodyMessage);
      });

      it('should return 409 if the replica already exists', async function () {
        const replica = generateFakeReplica();
        expect(await requestSender.postReplica(replica)).toHaveStatus(StatusCodes.CREATED);

        const response = await requestSender.postReplica(replica);

        expect(response).toHaveProperty('status', httpStatusCodes.CONFLICT);
        const message = (response.body as { message: string }).message;
        expect(message).toContain(`replica with id ${replica.replicaId} already exists`);
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const replicaUpdate = generateFakeReplicaUpdate();
        const response = await requestSender.patchReplica(faker.random.word(), replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request/params/replicaId must match format "uuid"');
      });

      it.each([
        [
          generateFakeReplicaUpdate({ replicaType: faker.random.word() as ReplicaType }),
          `request/body/replicaType must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakeReplicaUpdate({ geometryType: faker.random.word() as GeometryType }),
          `request/body/geometryType must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakeReplicaUpdate({ isHidden: faker.random.word() as unknown as boolean }), `request/body/isHidden must be boolean`],
        [generateFakeReplicaUpdate({ layerId: faker.random.word() as unknown as number }), `request/body/layerId must be number`],
        [generateFakeReplicaUpdate({ timestamp: faker.random.word() }), `request/body/timestamp must match format "date-time"`],
        [
          generateFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT - 1 }) }),
          `request/body/bucketName must NOT have fewer than ${BUCKET_NAME_MIN_LENGTH_LIMIT} characters`,
        ],
        [
          generateFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MAX_LENGTH_LIMIT + 1 }) }),
          `request/body/bucketName must NOT have more than ${BUCKET_NAME_MAX_LENGTH_LIMIT} characters`,
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
        const replicaUpdate = generateFakeReplicaUpdate();
        const fakeReplicaId = faker.datatype.uuid();
        const response = await requestSender.patchReplica(fakeReplicaId, replicaUpdate);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeReplicaId} was not found`);
      });
    });

    describe('PATCH /replica', function () {
      it.each([
        [
          generateFakePrivateFilter({ replicaType: faker.random.word() as ReplicaType }),
          `request/query/filter/replica_type must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakePrivateFilter({ geometryType: faker.random.word() as GeometryType }),
          `request/query/filter/geometry_type must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakePrivateFilter({ layerId: faker.random.word() as unknown as number }), `request/query/filter/layer_id must be number`],
        [generateFakePrivateFilter({ exclusiveFrom: faker.random.word() }), `request/query/filter/exclusive_from must match format "date-time"`],
        [generateFakePrivateFilter({ to: faker.random.word() }), `request/query/filter/to must match format "date-time"`],
        [generateFakePrivateFilter({ isHidden: faker.random.word() as unknown as boolean }), `request/query/filter/is_hidden must be boolean`],
      ])(
        'should return 400 status code if the filter has an invalid query parameter',
        async function (filter: BaseReplicaFilter, bodyMessage: string) {
          const response = await requestSender.patchReplicas(filter, {});

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );

      it.each([
        [
          generateFakeReplicaUpdate({ replicaType: faker.random.word() as ReplicaType }),
          `request/body/replicaType must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakeReplicaUpdate({ geometryType: faker.random.word() as GeometryType }),
          `request/body/geometryType must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakeReplicaUpdate({ isHidden: faker.random.word() as unknown as boolean }), `request/body/isHidden must be boolean`],
        [generateFakeReplicaUpdate({ layerId: faker.random.word() as unknown as number }), `request/body/layerId must be number`],
        [generateFakeReplicaUpdate({ timestamp: faker.random.word() }), `request/body/timestamp must match format "date-time"`],
        [
          generateFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MIN_LENGTH_LIMIT - 1 }) }),
          `request/body/bucketName must NOT have fewer than ${BUCKET_NAME_MIN_LENGTH_LIMIT} characters`,
        ],
        [
          generateFakeReplicaUpdate({ bucketName: faker.random.alpha({ count: BUCKET_NAME_MAX_LENGTH_LIMIT + 1 }) }),
          `request/body/bucketName must NOT have more than ${BUCKET_NAME_MAX_LENGTH_LIMIT} characters`,
        ],
      ])(
        'should return 400 status code if update replica body has an invalid parameter',
        async function (replicaUpdate: StringifiedReplicaUpdate, bodyMessage: string) {
          const response = await requestSender.patchReplicas(generateFakePrivateFilter(), replicaUpdate);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 400 status code if the replica id is not valid', async function () {
        const response = await requestSender.deleteReplica(faker.random.word());

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request/params/replicaId must match format "uuid"');
      });

      it('should return 404 status code if the requested replica id does not exist', async function () {
        const fakeReplicaId = faker.datatype.uuid();
        const response = await requestSender.deleteReplica(fakeReplicaId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `replica with id ${fakeReplicaId} was not found`);
      });
    });

    describe('DELETE /replica', function () {
      it.each([
        [
          generateFakePrivateFilter({ replicaType: faker.random.word() as ReplicaType }),
          `request/query/filter/replica_type must be equal to one of the allowed values: snapshot, delta`,
        ],
        [
          generateFakePrivateFilter({ geometryType: faker.random.word() as GeometryType }),
          `request/query/filter/geometry_type must be equal to one of the allowed values: point, linestring, polygon`,
        ],
        [generateFakePrivateFilter({ layerId: faker.random.word() as unknown as number }), `request/query/filter/layer_id must be number`],
        [generateFakePrivateFilter({ exclusiveFrom: faker.random.word() }), `request/query/filter/exclusive_from must match format "date-time"`],
        [generateFakePrivateFilter({ to: faker.random.word() }), `request/query/filter/to must match format "date-time"`],
        [generateFakePrivateFilter({ isHidden: faker.random.word() as unknown as boolean }), `request/query/filter/is_hidden must be boolean`],
      ])(
        'should return 400 status code if the filter has an invalid query parameter',
        async function (filter: BaseReplicaFilter, bodyMessage: string) {
          const response = await requestSender.deleteReplicas(filter);

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response.body).toHaveProperty('message', bodyMessage);
        }
      );
    });
  });

  describe('Sad Path', function () {
    describe('GET /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const findOneReplicaWithFilesMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { findOneReplicaWithFiles: findOneReplicaWithFilesMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
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
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { findLatestReplicaWithFiles: findLatestReplicaWithFilesMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.getLatestReplica(generateFakeBaseFilter());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('GET /replica', function () {
      it('should return 500 if the db throws an error', async function () {
        const findReplicasMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { findReplicas: findReplicasMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.getReplicas(generateFakePublicFilter());
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
          token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
          provider: { useValue: { findOneReplica: findOneReplicaMock } },
        });
        mockRegisterOptions.override.push(
          {
            token: FILE_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { findOneFile: findOneFileMock, createFileOnReplica: createFileOnReplicaMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.postFile(faker.datatype.uuid(), faker.datatype.uuid());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /replica', function () {
      it('should return 500 if the db throws an error', async function () {
        const createReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const findOneReplicaMock = jest.fn().mockResolvedValue(false);
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { createReplica: createReplicaMock, findOneReplica: findOneReplicaMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.postReplica(generateFakeReplica());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('PATCH /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const updateOneReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const findOneReplicaMock = jest.fn().mockResolvedValue(true);
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { updateOneReplica: updateOneReplicaMock, findOneReplica: findOneReplicaMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.patchReplica(faker.datatype.uuid(), generateFakeReplicaUpdate());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('PATCH /replica', function () {
      it('should return 500 if the db throws an error', async function () {
        const updateReplicasMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { updateReplicas: updateReplicasMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.patchReplicas(generateFakePrivateFilter(), generateFakeReplicaUpdate());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('DELETE /replica/{replicaId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const deleteOneReplicaMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { deleteOneReplica: deleteOneReplicaMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.deleteReplica(faker.datatype.uuid());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('DELETE /replica', function () {
      it('should return 500 if the db throws an error', async function () {
        const deleteReplicasMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));
        const mockRegisterOptions = getBaseRegisterOptions();
        mockRegisterOptions.override.push(
          {
            token: REPLICA_CUSTOM_REPOSITORY_SYMBOL,
            provider: { useValue: { deleteReplicas: deleteReplicasMock } },
          },
          {
            token: DATA_SOURCE_PROVIDER,
            provider: { useValue: connection },
          }
        );
        const [, mockApp] = await getApp(mockRegisterOptions);
        mockReplicaRequestSender = new ReplicaRequestSender(mockApp);
        const response = await mockReplicaRequestSender.deleteReplicas(generateFakePrivateFilter());
        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });
  });
});
