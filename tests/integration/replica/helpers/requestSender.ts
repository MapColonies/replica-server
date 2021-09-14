import * as supertest from 'supertest';
import { ReplicaMetadata } from '../../../../src/replica/models/replica';
import { StringifiedReplica } from './generators';

export class ReplicaRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getReplicaById(replicaId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).get(`/replica/${replicaId}`).set('Content-Type', 'application/json');
  }

  public async postReplica(body: StringifiedReplica): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/replica`).set('Content-Type', 'application/json').send(body);
  }

  public async patchReplica(replicaId: string, body: ReplicaMetadata): Promise<supertest.Response> {
    return supertest.agent(this.app).patch(`/replica/${replicaId}`).set('Content-Type', 'application/json').send(body);
  }

  public async postFile(replicaId: string, fileId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/replica/${replicaId}/file`).set('Content-Type', 'application/json').send({ fileId });
  }
}
