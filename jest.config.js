import { createDefaultEsmPreset, pathsToModuleNameMapper } from 'ts-jest';
import tsconfig from './tsconfig.json' with { type: 'json' };

const presetConfig = createDefaultEsmPreset({
  isolatedModules: true,
});

/** @type {import('ts-jest').JestConfigWithTsJest} **/
const jestConfig = {
  ...presetConfig,

  setupFilesAfterEnv: ['<rootDir>/test/setupFile.ts'],
  verbose: true,
  roots: ['<rootDir>'],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
    useESM: true,
  }),
};

export default jestConfig;
