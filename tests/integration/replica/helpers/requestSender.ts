import * as supertest from 'supertest';
import { BaseReplicaFilter } from '../../../../src/replica/models/replicaFilter';
import { convertObjectToSnakeCase } from '../../helpers';
import { StringifiedPrivateReplicaFilter, StringifiedPublicReplicaFilter, StringifiedReplica, StringifiedReplicaUpdate } from './generators';

export class ReplicaRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getReplicaById(replicaId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).get(`/replica/${replicaId}`);
  }

  public async getLatestReplica(filter: Partial<BaseReplicaFilter>): Promise<supertest.Response> {
    const snakeCasedFilter = convertObjectToSnakeCase(filter);
    return supertest.agent(this.app).get(`/replica/latest`).query(snakeCasedFilter);
  }

  public async getReplicas(filter: Partial<StringifiedPublicReplicaFilter>): Promise<supertest.Response> {
    const snakeCasedFilter = convertObjectToSnakeCase(filter);
    return supertest.agent(this.app).get(`/replica`).query(snakeCasedFilter);
  }

  public async postReplica(body: StringifiedReplica): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/replica`).set('Content-Type', 'application/json').send(body);
  }

  public async postFile(replicaId: string, fileId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/replica/${replicaId}/file`).set('Content-Type', 'application/json').send({ fileId });
  }

  public async patchReplica(replicaId: string, body: StringifiedReplicaUpdate): Promise<supertest.Response> {
    return supertest.agent(this.app).patch(`/replica/${replicaId}`).set('Content-Type', 'application/json').send(body);
  }

  public async patchReplicas(filter: Partial<StringifiedPrivateReplicaFilter>, body: StringifiedReplicaUpdate): Promise<supertest.Response> {
    const snakeCasedFilter = convertObjectToSnakeCase(filter);
    return supertest.agent(this.app).patch(`/replica`).query(snakeCasedFilter).set('Content-Type', 'application/json').send(body);
  }

  public async deleteReplica(replicaId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).delete(`/replica/${replicaId}`);
  }

  public async deleteReplicas(filter: Partial<StringifiedPrivateReplicaFilter>): Promise<supertest.Response> {
    const snakeCasedFilter = convertObjectToSnakeCase(filter);
    return supertest.agent(this.app).delete(`/replica`).query(snakeCasedFilter);
  }
}
