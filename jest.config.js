/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',

  setupFilesAfterEnv: [
    "<rootDir>/test/setupFile.ts"
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { useESM: true, isolatedModules: true },
    ],
  },
  verbose: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',

    "@/(.*)": "<rootDir>/src/$1",
    "@models/(.*)": "<rootDir>/src/models/$1",
    "@routers/(.*)": "<rootDir>/src/routers/$1",
    "@scripts/(.*)": "<rootDir>/scripts/$1",
    "@type/(.*)": "<rootDir>/src/types/$1",
    "@utils/(.*)": "<rootDir>/src/utils/$1",
  },
}

export default config;