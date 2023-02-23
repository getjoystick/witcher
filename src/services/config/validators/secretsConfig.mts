import Ajv from "ajv";
import { databaseConnectionOptionsValidator } from "./shared.mjs";

export const secretsConfigValidator = new Ajv().compile({
  type: "object",
  properties: {
    databaseConnectionOptions: databaseConnectionOptionsValidator,
  },
});
