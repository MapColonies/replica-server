import faker from 'faker';
import { createUrlPaths } from '../../../src/common/utils';

const URL_HEADER = 'https://some_address:443';
const SUB_PATHS = ['some', 'sub', 'path'];

describe('Util function', () => {
  it('should create a single url path', function () {
    const fileIds = [faker.datatype.uuid()];

    const urlPaths = createUrlPaths(URL_HEADER, SUB_PATHS, fileIds);

    expect(urlPaths).toHaveLength(1);
    expect(urlPaths[0]).toBe(`${URL_HEADER}/some/sub/path/${fileIds[0]}`);
  });

  it('should create multiple url paths', function () {
    const fileIds = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()];

    const urlPaths = createUrlPaths(URL_HEADER, SUB_PATHS, fileIds);

    expect(urlPaths).toHaveLength(fileIds.length);
    expect(urlPaths).toEqual([
      `${URL_HEADER}/some/sub/path/${fileIds[0]}`,
      `${URL_HEADER}/some/sub/path/${fileIds[1]}`,
      `${URL_HEADER}/some/sub/path/${fileIds[2]}`,
    ]);
  });

  it('should return empty array when there are no file ids as input', function () {
    const fileIds: string[] = [];

    const urlPaths = createUrlPaths(URL_HEADER, SUB_PATHS, fileIds);

    expect(urlPaths).toHaveLength(0);
    expect(urlPaths).toEqual([]);
  });
});
