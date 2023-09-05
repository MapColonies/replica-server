/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import './common/tracing';
import { createServer } from 'http';
import { createTerminus, HealthCheck } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, HEALTHCHECK_SYMBOL, ON_SIGNAL, SERVICES } from './common/constants';
import { getApp } from './app';

let depContainer: DependencyContainer | undefined;

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

void getApp()
  .then(([container, app]) => {
    depContainer = container;

    const logger = depContainer.resolve<Logger>(SERVICES.LOGGER);
    const healthCheck = depContainer.resolve<HealthCheck | boolean>(HEALTHCHECK_SYMBOL);

    const server = createTerminus(createServer(app), {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      healthChecks: { '/liveness': healthCheck, '/readiness': healthCheck },
      onSignal: depContainer.resolve(ON_SIGNAL),
    });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch(async (error: Error) => {
    const errorLogger =
      depContainer?.isRegistered(SERVICES.LOGGER) == true
        ? depContainer.resolve<Logger>(SERVICES.LOGGER).error.bind(depContainer.resolve<Logger>(SERVICES.LOGGER))
        : console.error;
    errorLogger({ msg: '😢 - failed initializing the server', err: error });

    if (depContainer?.isRegistered(ON_SIGNAL) === true) {
      const shutDown: () => Promise<void> = depContainer.resolve(ON_SIGNAL);
      await shutDown();
    }
  });
