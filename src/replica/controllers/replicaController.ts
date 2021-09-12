/* eslint-disable @typescript-eslint/naming-convention */ // query params are in snake case
import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SnakeCasedProperties } from 'type-fest';

import { Services } from '../../common/constants';
import { HttpError } from '../../common/errors';
import { ReplicaAlreadyExistsError, ReplicaNotFoundError } from '../models/errors';
import { Replica, ReplicaMetadata, ReplicaResponse } from '../models/replica';
import { ReplicaManager } from '../models/replicaManager';
import { BaseReplicaFilter, PrivateReplicaFilter, PublicReplicaFilter } from '../models/replicaFilter';

type BaseReplicaFilterQueryParams = SnakeCasedProperties<BaseReplicaFilter>;
type PublicReplicaFilterQueryParams = SnakeCasedProperties<PublicReplicaFilter>;
type PrivateReplicaFilterQueryParams = SnakeCasedProperties<PrivateReplicaFilter>;

type GetReplicaByIdHandler = RequestHandler<{ replicaId: string }, ReplicaResponse>;
type GetLatestReplicaHandler = RequestHandler<undefined, ReplicaResponse, undefined, BaseReplicaFilterQueryParams>;
type GetReplicasHandler = RequestHandler<undefined, ReplicaResponse[], undefined, PublicReplicaFilterQueryParams>;
type PostReplicaHandler = RequestHandler<undefined, undefined, Replica>;
type PostFileHandler = RequestHandler<{ replicaId: string }>;
type PatchReplicasHandler = RequestHandler<undefined, undefined, ReplicaMetadata, { filter: PrivateReplicaFilterQueryParams }>;
type DeleteReplicasHandler = RequestHandler<undefined, ReplicaResponse[], undefined, { filter: PrivateReplicaFilterQueryParams }>;

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

  public getReplicas: GetReplicasHandler = async (req, res, next) => {
    try {
      const { replica_type, geometry_type, layer_id, exclusive_from, to, sort } = req.query;
      const filter: PublicReplicaFilter = {
        replicaType: replica_type,
        geometryType: geometry_type,
        layerId: layer_id,
        exclusiveFrom: exclusive_from,
        to: to,
        sort: sort,
      };
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
    try {
      await this.manager.createFileOnReplica(req.params.replicaId);
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
      const { replica_type, geometry_type, layer_id, sync_id, is_hidden, exclusive_from, to } = req.query.filter;
      const filter: PrivateReplicaFilter = {
        replicaType: replica_type,
        geometryType: geometry_type,
        layerId: layer_id,
        syncId: sync_id,
        isHidden: is_hidden,
        exclusiveFrom: exclusive_from,
        to: to,
      };
      await this.manager.updateReplicas(filter, req.body);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      return next(error);
    }
  };

  public deleteReplicas: DeleteReplicasHandler = async (req, res, next) => {
    try {
      const { replica_type, geometry_type, layer_id, sync_id, is_hidden, exclusive_from, to } = req.query.filter;
      const filter: PrivateReplicaFilter = {
        replicaType: replica_type,
        geometryType: geometry_type,
        layerId: layer_id,
        syncId: sync_id,
        isHidden: is_hidden,
        exclusiveFrom: exclusive_from,
        to: to,
      };
      const deletedReplicas = await this.manager.deleteReplicas(filter);
      return res.status(httpStatus.OK).json(deletedReplicas);
    } catch (error) {
      return next(error);
    }
  };
}
