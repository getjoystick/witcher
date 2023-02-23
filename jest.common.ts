import type { JestConfigWithTsJest } from "ts-jest";

export default {
  testEnvironment: "node",
  preset: "ts-jest/presets/default-esm", // or other ESM presets
  extensionsToTreatAsEsm: [".ts", ".mts"],
  moduleFileExtensions: ["ts", "mts", "js", "json"],
  transform: {
    "^.+\\.mts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.m?js$": "$1",
  },
} as JestConfigWithTsJest;
