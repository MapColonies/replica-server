/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus, HealthCheck } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, Services } from './common/constants';

import { getApp } from './app';
import { IServerConfig } from './common/interfaces';

const serverConfig = config.get<IServerConfig>('server');
const port: number = parseInt(serverConfig.port) || DEFAULT_SERVER_PORT;

void getApp()
  .then((app) => {
    const logger = container.resolve<Logger>(Services.LOGGER);
    const healthCheck = container.resolve<HealthCheck>('healthcheck');
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const server = createTerminus(createServer(app), { healthChecks: { '/liveness': healthCheck, onSignal: container.resolve('onSignal') } });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch((error: Error) => {
    console.error('😢 - failed initializing the server');
    console.error(error.message);
  });
