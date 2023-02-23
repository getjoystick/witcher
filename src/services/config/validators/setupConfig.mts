import Ajv from "ajv";
import { databaseConnectionOptionsValidator } from "./shared.mjs";

export default new Ajv().compile({
  type: "object",
  properties: {
    testUnitsConfigs: {
      type: "array",
      items: {
        type: "string",
      },
    },
    databaseConnectionOptions: databaseConnectionOptionsValidator,
    initialTestRunVariables: {
      type: "object",
      additionalProperties: true,
    },
    testRunnerOptions: {
      type: "object",
      properties: {
        debugResponseOptions: {
          type: "object",
          properties: {
            showRequestErrors: { type: "boolean" },
            showBody: { type: "boolean" },
            showHeaders: { type: "boolean" },
            showStatusCode: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      required: ["debugResponseOptions"],
      additionalProperties: false,
    },
  },
  required: ["testUnitsConfigs"],
  additionalProperties: false,
});

export class InvalidSetupConfigError extends Error {
  constructor(
    message: string,
    public readonly errors?: string[],
  ) {
    super(message);
    this.name = "InvalidSetupConfigError";
  }
}
