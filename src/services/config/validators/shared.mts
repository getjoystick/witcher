import { AnySchema } from "ajv";

export const databaseConnectionOptionsValidator: AnySchema = {
  type: "object",
  properties: {
    dbms: { type: "string", enum: ["postgresql", "mysql"] },
    host: { type: "string" },
    port: { type: "number" },
    user: { type: "string" },
    password: { type: "string" },
    database: { type: "string" },
    sslCertificate: { type: "string" },
    sslCertificatePath: { type: "string" },
  },
  required: ["dbms", "host", "user", "password", "database"],
  allOf: [
    {
      not: {
        anyOf: [{ required: ["sslCertificate", "sslCertificatePath"] }],
      },
    },
  ],
  additionalProperties: false,
};
