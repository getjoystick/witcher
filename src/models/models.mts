// TEST UNIT
export type TestUnitsConfigRaw = {
  testUnits: TestConfig[];
};

export type TestConfig = {
  name: string;
  description?: string;
  validation?: {
    statusCode?: number | string[]; // Optional. If not present, then expecting 200
    tablesToCheck?: TableToCheck[]; // Optional.
    assertions?: Assertion[]; // Optional.
    tablesHaveNoUnexpectedRowCountChanges?: boolean; // Optional.
  };
  endpointDetails: EndpointDetails;
  variablesToSet?: PathToVariableMap[];
};

export type EndpointDetails = {
  method: string;
  url: string;
  headers: { [key: string]: string };
  body?: unknown;
};

export type Assertion = {
  path: string;
  assertion: string;
};

export type TableToCheck = {
  tableName: string;
  schemaName?: string;
  rowChecks?: RowCheck[];
  expectedRowCountChange?: number;
};

export type RowCheck = {
  queryFilter?: { [key: string]: unknown };
  columnChecks: { [key: string]: string };
  rowCountAssertion?: string;
};

export type PathToVariableMap = {
  variableName: string;
  path: string;
};

// COMMON

export type TestRunVariables = { [key: string]: string };

// SETUP

export type SetupConfigRaw = {
  testUnitsConfigs: string[];
  databaseConnectionOptions: DatabaseConnectionOptions;
  initialTestRunVariables?: TestRunVariables;
  testRunnerOptions?: TestRunnerOptions;
};

export type DatabaseConnectionOptions = {
  dbms: "postgresql" | "mysql";
  host: string;
  user: string;
  password: string;
  database: string;
  sslCertificatePath?: string;
};

export type TestRunnerOptions = {
  debugResponseOptions: DebugResponseOptions;
};

export type DebugResponseOptions = {
  showRequestErrors?: boolean;
  showBody: boolean;
  showHeaders: boolean;
  showStatusCode: boolean;
};

export type ParsedValue = string | number | boolean | null | undefined;

// TODO: Can make a generic validation object that specifies the part and expected value.
// {
//     "validate": "response.statusCode",   // what part to validate
//     "expectedValue": 200                 // What is the expected value
// },
// {
//     "validate": "databaseTables",
//     "expectedValue": TablesToCheck[]
// }

// SECRETS
export type SecretsConfigRaw = {
  databaseConnectionOptions: DatabaseConnectionOptions;
};
