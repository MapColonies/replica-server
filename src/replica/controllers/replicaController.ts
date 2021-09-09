import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { Services } from '../../common/constants';
import { HttpError } from '../../common/errors';
import { ReplicaAlreadyExistsError, ReplicaNotFoundError } from '../models/errors';
import { Replica, ReplicaResponse } from '../models/replica';

import { ReplicaManager } from '../models/replicaManager';
import { GeneralResponse } from '../../common/interfaces';
import { BaseReplicaFilter, BaseReplicaFilterQueryParams } from '../models/replicaFilter';

type GetReplicaByIdHandler = RequestHandler<{ replicaId: string }, ReplicaResponse>;
type GetLatestReplicaHandler = RequestHandler<undefined, ReplicaResponse, undefined, BaseReplicaFilterQueryParams>;
type PostReplicaHandler = RequestHandler<undefined, GeneralResponse, Replica>;
type PostFileHandler = RequestHandler<{ replicaId: string }, GeneralResponse>;

@injectable()
export class ReplicaController {
  public constructor(@inject(Services.LOGGER) private readonly logger: Logger, @inject(ReplicaManager) private readonly manager: ReplicaManager) {}

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
      const { replica_type, geometry_type, layer_id } = req.query;
      const filter: BaseReplicaFilter = { replicaType: replica_type, geometryType: geometry_type, layerId: layer_id };
      const replica = await this.manager.getLatestReplica(filter);
      return res.status(httpStatus.OK).json(replica);
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };

  public postReplica: PostReplicaHandler = async (req, res, next) => {
    try {
      await this.manager.createReplica(req.body);
      return res.status(httpStatus.CREATED).json({ message: httpStatus.getStatusText(httpStatus.CREATED) });
    } catch (error) {
      if (error instanceof ReplicaAlreadyExistsError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public postFile: PostFileHandler = async (req, res, next) => {
    try {
      await this.manager.createFileOnReplica(req.params.replicaId);
      return res.status(httpStatus.OK).json({ message: httpStatus.getStatusText(httpStatus.CREATED) });
    } catch (error) {
      if (error instanceof ReplicaNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      }
      return next(error);
    }
  };
}
