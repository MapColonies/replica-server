import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { Services } from '../../src/common/constants';
import { GeometryType } from '../../src/common/enums';
import { IObjectStorageConfig } from '../../src/common/interfaces';
import { RegisterOptions } from '../../src/containerConfig';

export const getBaseRegisterOptions = (): Required<RegisterOptions> => {
  return {
    override: [
      { token: Services.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      { token: Services.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    ],
    useChild: true,
  };
};

export const getMockObjectStorageConfig = (includeProjectId = false): IObjectStorageConfig => {
  const objectStorageConfig: IObjectStorageConfig = { protocol: 'http', host: 'some_storage_host', port: '9000' };
  if (includeProjectId) {
    objectStorageConfig.projectId = 'some_project_id';
  }
  return objectStorageConfig;
};

export const convertReplicaToUrls = (
  replica: { bucketName: string; layerId: number; geometryType: GeometryType },
  fileIds: string[],
  includeProjectId = false
): string[] => {
  const { protocol, host, projectId, port } = getMockObjectStorageConfig(includeProjectId);
  const { bucketName, layerId, geometryType } = replica;

  let bucketOrProjectIdWithBucket = bucketName;
  if (includeProjectId && projectId !== undefined) {
    bucketOrProjectIdWithBucket = `${projectId}:${bucketName}`;
  }
  return fileIds.map((fileId) => `${protocol}://${host}:${port}/${bucketOrProjectIdWithBucket}/${layerId}/${geometryType}/${fileId}`);
};
