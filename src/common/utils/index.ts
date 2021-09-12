export const removeUndefinedPropertiesFromObject = <T>(obj: T): void => {
  (Object.keys(obj) as (keyof typeof obj)[]).forEach((key) => obj[key] === undefined && delete obj[key]);
};
