import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/, /^.*\/metrics.*/];

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('Metrics'),
  OBJECT_STORAGE: Symbol('IObjectStorage'),
  CLEANUP_REGISTRY: Symbol('CleanupRegistry'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */

export const BUCKET_NAME_MIN_LENGTH_LIMIT = 3;

export const BUCKET_NAME_MAX_LENGTH_LIMIT = 63;

export const HEALTHCHECK = Symbol('healthcheck');
export const ON_SIGNAL = Symbol('onSignal');
