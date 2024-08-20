/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',

  setupFilesAfterEnv: [
    "<rootDir>/test/setupFile.ts"
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  verbose: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',

    "@routers/(.*)": [
      "../../src/routers/$1",
      "../../src/routers",
      "../src/routers/$1",
      "../src/routers"
    ],
    "@models/(.*)": [
      "../../src/models/$1",
      "../../src/models",
      "../src/models/$1",
      "../src/models"
    ],
    "@type/(.*)": [
      "../../src/types/$1",
      "../../src/types",
      "../src/types/$1",
      "../src/types"
    ],
    "@/(.*)": [
      "../../src/$1",
      "../src/$1"
    ]
  }
}

export default config;