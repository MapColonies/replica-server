module.exports = {
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/matchers.js'],
  coverageReporters: ['text', 'html'],
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!*/node_modules/', '!/vendor/**', '!*/common/**', '!**/models/**', '!<rootDir>/src/*'],
  coverageDirectory: '<rootDir>/coverage',
  rootDir: '../../../.',
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  setupFiles: ['<rootDir>/tests/configurations/jest.setup.js'],
  globalSetup: '<rootDir>/tests/configurations/jest.globalSetup.ts',
  reporters: [
    'default',
    [
      'jest-html-reporters',
      { multipleReportsUnitePath: './report', pageTitle: 'integration', publicPath: './reports', filename: 'integration.html' },
    ],
  ],
  moduleDirectories: ['node_modules', 'src'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: -10,
    },
  },
};
