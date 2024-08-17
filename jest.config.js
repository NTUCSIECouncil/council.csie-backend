/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  verbose: true,
  moduleNameMapper: {
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