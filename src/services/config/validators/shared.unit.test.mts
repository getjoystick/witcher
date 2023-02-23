import Ajv, { ValidateFunction } from "ajv";
import { databaseConnectionOptionsValidator } from "./shared.mjs";

describe("DB connection options test", () => {
  let validate: ValidateFunction;
  beforeEach(() => {
    validate = new Ajv().compile(databaseConnectionOptionsValidator);
  });

  describe("Mutually exclusive `sslCertificate` and `sslCertificatePath`", () => {
    const base = {
      dbms: "postgresql",
      host: "...",
      port: 25060,
      database: "...",
      user: "...",
      password: "...",
    };

    it("should allow neither sslCertificate, nor sslCertificatePath to be present", () => {
      const dataToValidate = base;
      const result = validate(dataToValidate);

      expect(validate.errors).toBeNull();
      expect(result).toBeTruthy();
    });

    it("should allow sslCertificate to be specified independently", () => {
      const dataToValidate = {
        ...base,
        sslCertificate: "some-certificate",
      };
      const result = validate(dataToValidate);

      expect(validate.errors).toBeNull();
      expect(result).toBeTruthy();
    });

    it("should allow sslCertificatePath to be specified independently", () => {
      const dataToValidate = {
        ...base,
        sslCertificatePath: "some-certificate",
      };
      const result = validate(dataToValidate);

      expect(validate.errors).toBeNull();
      expect(result).toBeTruthy();
    });

    it("should disallow both sslCertificatePath and sslCertificate to be specified", () => {
      const dataToValidate = {
        ...base,
        sslCertificatePath: "some-certificate",
        sslCertificate: "some-certificate",
      };
      const result = validate(dataToValidate);

      expect(validate.errors).not.toBeNull();
      expect(result).toBeFalsy();
    });
  });
});
