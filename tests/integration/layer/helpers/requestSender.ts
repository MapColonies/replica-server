import * as supertest from 'supertest';

export class LayerRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getLayers(): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/layers');
  }
}
