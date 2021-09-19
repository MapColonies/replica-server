import { CamelCasedProperties } from 'type-fest';
import camelCase from 'camelcase';

export const isStringUndefinedOrEmpty = (input: string | undefined): input is undefined => {
  return input === undefined || input.length === 0;
};

export const convertObjectToCamelCase = <T extends Record<string, unknown>>(obj: T): CamelCasedProperties<T> => {
  const keyValues = Object.entries(obj);

  let camelCasedObject = {};

  for (const [key, value] of keyValues) {
    camelCasedObject = { ...camelCasedObject, [camelCase(key)]: value };
  }

  return camelCasedObject as CamelCasedProperties<T>;
};
