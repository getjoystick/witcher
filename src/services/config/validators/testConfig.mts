import Ajv from "ajv";
import { Assertion, PathToVariableMap, TableToCheck, TestConfig, TestUnitsConfigRaw } from "../../../models/models.mjs";
import { validateAssertion, variableRegexFullSyntax } from "../../../helpers.mjs";
import TestRunnerService from "../../testRunnerService.mjs";

export const testUnitsConfigValidator = new Ajv().compile({
  type: "object",
  properties: {
    testUnits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          waitForMs: { type: "number", minimum: 0 },
          endpointDetails: {
            type: "object",
            properties: {
              method: { type: "string" },
              url: { type: "string" },
              headers: {
                type: "object",
                additionalProperties: true,
              },
              body: {},
            },
            required: ["method", "url"],
          },
          variablesToSet: {
            type: "array",
            items: {
              type: "object",
              properties: {
                variableName: { type: "string" },
                path: { type: "string" },
              },
              required: ["variableName", "path"],
            },
          },
          validation: {
            type: "object",
            properties: {
              assertions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    assertion: { type: "string" },
                  },
                  required: ["path", "assertion"],
                  additionalProperties: false,
                },
              },
              tablesToCheck: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tableName: { type: "string" },
                    schemaName: { type: "string" },
                    rowChecks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          queryFilter: {
                            type: "object",
                            additionalProperties: true,
                          },
                          columnChecks: {
                            type: "object",
                            additionalProperties: true,
                          },
                          rowCountAssertion: { type: "string" },
                        },
                        anyOf: [
                          { required: ["columnChecks"] },
                          { required: ["rowCountAssertion"] },
                          { required: ["rowCountAssertion", "columnChecks"] },
                        ],
                        additionalProperties: false,
                      },
                    },
                    expectedRowCountChange: { type: "number" },
                    additionalProperties: false,
                  },
                  required: ["tableName"],
                },
              },
              statusCode: {
                oneOf: [
                  { type: "number" },
                  {
                    type: "array",
                    items: { type: "string" },
                  },
                ],
              },
              tablesHaveNoUnexpectedRowCountChanges: { type: "boolean" },
            },
          },
        },
        required: ["name", "endpointDetails"],
        additionalProperties: false,
      },
    },
  },
  required: ["testUnits"],
  additionalProperties: false,
});

// TODO: Support multiple endpoints and databases, and a way in the TestConfig to specify which one to use.
export const validateConfigsAndExtractTestSet = (
  testsUnitsConfigs: TestUnitsConfigRaw[],
  initialVariables: string[],
): TestConfig[] => {
  let tests: TestConfig[] = [];
  for (let i = 0; i < testsUnitsConfigs.length; i++) {
    // Validate the test unit matches the expected schema.
    if (!testUnitsConfigValidator(testsUnitsConfigs[i])) {
      console.error(`    🛑 Test Units validation failed at index ${i}:`);
      testUnitsConfigValidator.errors?.forEach((error) => {
        console.error(`    ${error.instancePath} ${error.message}`);
      });
      throw new Error(`Test config validation failed.`);
    }

    tests = tests.concat(testsUnitsConfigs[i].testUnits);
  }

  // Let's check that in the tests, we are using variables only after they have been defined.
  const definedVariables = new Set<string>(initialVariables.concat(TestRunnerService.getPredefinedVariables()));

  for (let i = 0; i < tests.length; i++) {
    let test = tests[i];
    let testAsJson = JSON.stringify(test);
    // check if there are any variables in the test unit.
    const matches = testAsJson.matchAll(variableRegexFullSyntax);
    // check if the variables have been previously defined.
    if (matches) {
      for (const match of matches) {
        if (!definedVariables.has(match[1])) {
          console.error(`    🛑 Test Units configuration validation failed.`);
          console.error(
            `       Test Unit "${test.name}" attempts to use variable "` +
              "${ " +
              `${match[1]}` +
              ` }" before it is set. Please set the variable before using it.`,
          );
          throw new Error(`Attempting to use variable prior to assignment`);
        }
      }
    }
    testAsJson = testAsJson.replaceAll(variableRegexFullSyntax, "1");
    test = JSON.parse(testAsJson);

    // Validate the assertions are written correctly.
    if (test.validation?.tablesToCheck) {
      test.validation.tablesToCheck.forEach((tableToCheck: TableToCheck, idx: number) =>
        validateRawTableToCheck(idx, test.name, tableToCheck),
      );
    }
    if (test.validation?.assertions) {
      test.validation.assertions.forEach((assertion: Assertion, idx: number) =>
        validateRawAssertion(idx, test.name, assertion),
      );
    }

    // Add any newly defined variables to the list of defined variables.
    if (test.variablesToSet) {
      test.variablesToSet.forEach((variableToSet: PathToVariableMap) =>
        definedVariables.add(variableToSet.variableName),
      );
    }
  }

  return tests;
};

const validateRawAssertion = (idx: number, name: string, assertion: { path: string; assertion: string }): void => {
  try {
    validateAssertion(assertion.path, assertion.assertion);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Test config "${name}": ${error.message}`);
    }
    throw new Error(`Test config "${name}": ${error}`);
  }
};

const validateRawTableToCheck = (idx: number, name: string, tableToCheck: TableToCheck): void => {
  try {
    tableToCheck.rowChecks?.forEach((rowCheck, idx: number) => {
      for (const path in rowCheck.columnChecks) {
        validateAssertion(path, rowCheck.columnChecks[path]);
      }
      if (rowCheck.rowCountAssertion) {
        validateRawAssertion(idx, name, {
          path: `${tableToCheck.tableName} rows count`,
          assertion: rowCheck.rowCountAssertion,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Test "${name}" has invalid db table assertion: ${error.message}`);
    }
    throw new Error(`Test "${name}" has invalid db table row assertion: ${error}`);
  }
};
