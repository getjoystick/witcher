import { ValidateFunction } from "ajv";
import { secretsConfigValidator } from "./secretsConfig.mjs";

describe("DB connection options test", () => {
  let validate: ValidateFunction;
  beforeEach(() => {
    validate = secretsConfigValidator;
  });

  it("should allow databaseConnectionOptions not to be present", () => {
    const dataToValidate = {};
    const result = validate(dataToValidate);

    expect(validate.errors).toBeNull();
    expect(result).toBeTruthy();
  });
});
