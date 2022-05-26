import { Application } from 'express';
import { DependencyContainer } from 'tsyringe';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './serverBuilder';

async function getApp(registerOptions?: RegisterOptions): Promise<[DependencyContainer, Application]> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();
  return [container, app];
}

export { getApp };
