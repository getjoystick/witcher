export const databaseConnectionOptionsValidator = {
  type: "object",
  properties: {
    dbms: { type: "string", enum: ["postgresql", "mysql"] },
    host: { type: "string" },
    port: { type: "number" },
    user: { type: "string" },
    password: { type: "string" },
    database: { type: "string" },
    sslCertificatePath: { type: "string" },
  },
  required: ["dbms", "host", "user", "password", "database"],
  additionalProperties: false,
};
