import { faker } from '@faker-js/faker';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { snakeCase } from 'snake-case';
import { SnakeCasedProperties } from 'type-fest';
import { Services } from '../../src/common/constants';
import { SortFilter } from '../../src/common/types';
import { RegisterOptions } from '../../src/containerConfig';

export const BEFORE_ALL_TIMEOUT = 10000;

export const FLOW_TEST_TIMEOUT = 20000;

export const DEFAULT_SORT = 'desc';

export const BOTTOM_FROM = faker.date.past();

export const TOP_TO = faker.date.future();

export const getBaseRegisterOptions = (): Required<RegisterOptions> => {
  return {
    override: [
      { token: Services.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      { token: Services.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    ],
    useChild: true,
  };
};

export const convertObjectToSnakeCase = <T extends Record<string, unknown>>(obj: T): SnakeCasedProperties<T> => {
  const keyValues = Object.entries(obj);

  let snakeCasedObject = {};

  for (const [key, value] of keyValues) {
    snakeCasedObject = { ...snakeCasedObject, [snakeCase(key)]: value };
  }

  return snakeCasedObject as SnakeCasedProperties<T>;
};

export const sortByOrderFilter = <T extends { timestamp: string | Date }>(data: T[], sort: SortFilter = DEFAULT_SORT): T[] => {
  return data.sort((itemA, itemB) => {
    const dateA = +new Date(itemA.timestamp);
    const dateB = +new Date(itemB.timestamp);
    return sort === DEFAULT_SORT ? dateB - dateA : dateA - dateB;
  });
};

export const createFakeDateBetweenBottomAndTop = (): Date => {
  return faker.date.between(BOTTOM_FROM, TOP_TO);
};
