import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { HttpError } from '@map-colonies/error-express-handler';
import { injectable, inject } from 'tsyringe';
import { SnakeCasedProperties } from 'type-fest';
import { SERVICES } from '../../common/constants';
import { FileAlreadyExistsError, ReplicaAlreadyExistsError, ReplicaNotFoundError } from '../models/errors';
import { ReplicaCreateBody, ReplicaMetadata, ReplicaResponse } from '../models/replica';
import { ReplicaManager } from '../models/replicaManager';
import { BaseReplicaFilter, PrivateReplicaFilter, PublicReplicaFilter } from '../models/replicaFilter';
import { convertObjectToCamelCase } from '../../common/utils';

type BaseReplicaFilterQueryParams = SnakeCasedProperties<BaseReplicaFilter>;
type PublicReplicaFilterQueryParams = SnakeCasedProperties<PublicReplicaFilter>;
type PrivateReplicaFilterQueryParams = SnakeCasedProperties<PrivateReplicaFilter>;

type GetReplicaByIdHandler = RequestHandler<{ replicaId: string }, ReplicaResponse>;
type GetLatestReplicaHandler = RequestHandler<undefined, ReplicaResponse, undefined, BaseReplicaFilterQueryParams>;
type GetReplicasHandler = RequestHandler<undefined, ReplicaResponse[], undefined, PublicReplicaFilterQueryParams>;
type PostReplicaHandler = RequestHandler<undefined, undefined, ReplicaCreateBody>;
type PostFileHandler = RequestHandler<{ replicaId: string }, undefined, { fileId: string }>;
type PatchReplicaHandler = RequestHandler<{ replicaId: string }, undefined, ReplicaMetadata>;
type PatchReplicasHandler = RequestHandler<undefined, undefined, ReplicaMetadata, { filter: PrivateReplicaFilterQueryParams }>;
type DeleteReplicaHandler = RequestHandler<{ replicaId: string }, ReplicaResponse>;
type DeleteReplicasHandler = RequestHandler<undefined, ReplicaResponse[], undefined, { filter: PrivateReplicaFilterQueryParams }>;

@injectable()
export class ReplicaController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ReplicaManager) private readonly manager: ReplicaManager) {}

  public getReplicaById: GetReplicaByIdHandler = async (req, res, next) => {
    try {
      const replica = await this.manager.getReplicaById(req.params.replicaId);
      return res.status(httpStatus.OK).json(replica);
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public getLatestReplica: GetLatestReplicaHandler = async (req, res, next) => {
    try {
      const filter: BaseReplicaFilter = convertObjectToCamelCase(req.query);
      const replica = await this.manager.getLatestReplica(filter);
      return res.status(httpStatus.OK).json(replica);
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public getReplicas: GetReplicasHandler = async (req, res, next) => {
    try {
      const filter: PublicReplicaFilter = convertObjectToCamelCase(req.query);
      const replicas = await this.manager.getReplicas(filter);
      return res.status(httpStatus.OK).json(replicas);
    } catch (error) {
      return next(error);
    }
  };

  public postReplica: PostReplicaHandler = async (req, res, next) => {
    try {
      await this.manager.createReplica(req.body);
      return res.status(httpStatus.CREATED).json();
    } catch (error) {
      if (error instanceof ReplicaAlreadyExistsError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public postFile: PostFileHandler = async (req, res, next) => {
    const {
      params: { replicaId },
      body: { fileId },
    } = req;
    try {
      await this.manager.createFileOnReplica(replicaId, fileId);
      return res.status(httpStatus.CREATED).json();
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      if (error instanceof FileAlreadyExistsError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public patchReplica: PatchReplicaHandler = async (req, res, next) => {
    try {
      await this.manager.updateReplica(req.params.replicaId, req.body);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public patchReplicas: PatchReplicasHandler = async (req, res, next) => {
    try {
      const filter: PrivateReplicaFilter = convertObjectToCamelCase(req.query.filter);
      await this.manager.updateReplicas(filter, req.body);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      return next(error);
    }
  };

  public deleteReplica: DeleteReplicaHandler = async (req, res, next) => {
    try {
      const deletedReplica = await this.manager.deleteReplica(req.params.replicaId);
      return res.status(httpStatus.OK).json(deletedReplica);
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public deleteReplicas: DeleteReplicasHandler = async (req, res, next) => {
    try {
      const filter: PrivateReplicaFilter = convertObjectToCamelCase(req.query.filter);
      const deletedReplicas = await this.manager.deleteReplicas(filter);
      return res.status(httpStatus.OK).json(deletedReplicas);
    } catch (error) {
      return next(error);
    }
  };
}
