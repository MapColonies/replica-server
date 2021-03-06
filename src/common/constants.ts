export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/, /^.*\/metrics.*/];

export const SERVICE_NAME = 'ts-server-boilerplate';

export enum Services {
  LOGGER = 'ILogger',
  CONFIG = 'IConfig',
  TRACER = 'TRACER',
  METER = 'METER',
  OBJECT_STORAGE = 'IObjectStorage',
}

export const BUCKET_NAME_MIN_LENGTH_LIMIT = 3;

export const BUCKET_NAME_MAX_LENGTH_LIMIT = 63;
