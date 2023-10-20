import { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  verbose: true,
  collectCoverage: true,
  transform: {
    '^.*.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
};

module.exports = exports = config;
