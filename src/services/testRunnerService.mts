import axios, { AxiosError } from "axios"; // Newer node has fetch built in, node-fetch has known issue with hanging with larger responses. Using axios for now.
import { AxiosResponse, AxiosRequestConfig } from "axios";
import { TestConfig, TestRunnerOptions as TestRunnerOptions, TestRunVariables } from "../models/models.mjs";
import DatabaseServiceInterface from "./db/databaseServiceInterface.mjs";
import {
  responseLoggingAndDiagnostics,
  setTestRunVariablesFromResponse,
  FetchUtils,
  checkAssertion,
  variableRegex,
  variableRegexNumber,
  getUTCTimeNowString,
  checkStatusCode,
  checkTables,
} from "../helpers.mjs";

export default class TestRunnerService {
  // create a testRunHash string variable to use later
  public testRunVariables: TestRunVariables;
  private dbService!: DatabaseServiceInterface;
  private testRunnerOptions: TestRunnerOptions = {
    debugResponseOptions: {
      showBody: false,
      showHeaders: false,
      showStatusCode: false,
      showRequestErrors: false,
    },
  };

  // constructor to set the testRunHash
  constructor(
    dbService: DatabaseServiceInterface | undefined = undefined,
    initialTestRunVariables: TestRunVariables = {},
    testRunnerOptions: TestRunnerOptions | undefined = undefined,
  ) {
    // Set a unique testRunHash for this test run.
    this.testRunVariables = initialTestRunVariables;
    this.testRunVariables["testRunHash"] = Math.random().toString(36).substring(2, 8);

    // TODO: refactor handling of optional dbService.
    if (typeof dbService !== "undefined") this.dbService = dbService;

    // TODO: refactor handling of test run options with optional assignment for individual options.
    if (typeof testRunnerOptions !== "undefined") this.testRunnerOptions = testRunnerOptions;
  }

  public async runTest(testConfigRaw: TestConfig): Promise<boolean> {
    let success = true;
    let tableCountsBefore: {
      tableName: string;
      schemaName?: string;
      count: number;
    }[] = [];
    let apiResponse: AxiosResponse;

    console.info(`\n\n💊💊💊💊💊 RUNNING TEST: ${testConfigRaw.name} 💊💊💊💊💊`);

    // Do the variable replacement.
    // TODO: handle error if the requested variable is not available in testRunVariables.
    const testConfig: TestConfig = TestRunnerService.replaceVariables(testConfigRaw, this.testRunVariables);
    if (testConfig?.description) console.info(`${testConfig.description}`);
    console.info(`🔗🔗🔗🔗🔗 ${testConfig.endpointDetails.method.toUpperCase()} ${testConfig.endpointDetails.url}`);

    if (
      typeof this.dbService !== "undefined" &&
      (testConfig.validation?.tablesToCheck || testConfig.validation?.tablesHaveNoUnexpectedRowCountChanges)
    ) {
      // Check if the tablesToCheck array exists on the testConfig object. If so, check do the table check.
      if (testConfig.validation?.tablesHaveNoUnexpectedRowCountChanges) {
        tableCountsBefore = await this.dbService.countRowsForAllTables();
      } else if (testConfig.validation?.tablesToCheck) {
        // for each item in the tablesToCheck array, iterate and check the length of the table then save it to an object with the table name as the key.
        await Promise.all(
          testConfig.validation.tablesToCheck.map(async (tableToCheck) => {
            if (tableToCheck.expectedRowCountChange !== undefined) {
              tableCountsBefore.push({
                tableName: tableToCheck.tableName,
                schemaName: tableToCheck.schemaName,
                count: await this.dbService.countRows(tableToCheck.tableName, tableToCheck.schemaName),
              });
            }
          }),
        );
      }
    } else if (
      typeof this.dbService === "undefined" &&
      (testConfig.validation?.tablesToCheck || testConfig.validation?.tablesHaveNoUnexpectedRowCountChanges)
    ) {
      console.info(`🗄️ 🟡  Table Validation SKIPPED. No database service available.`);
    }

    // Construct the API Request Config
    const requestConfig: AxiosRequestConfig = {
      method: testConfig.endpointDetails.method,
      validateStatus: null,
    };

    if (testConfig?.endpointDetails?.headers) {
      requestConfig.headers = testConfig.endpointDetails.headers;
    }

    if (testConfig?.endpointDetails?.body) {
      requestConfig.data = testConfig.endpointDetails.body;
    }

    // Make the request to the API
    try {
      apiResponse = await axios(testConfig.endpointDetails.url, requestConfig);
    } catch (error) {
      // TODO: improve error handling with optional keep going or stop the entire run.

      if (this.testRunnerOptions.debugResponseOptions?.showRequestErrors) {
        console.error("🔗❌ Error: Test skipped! An error occurred while attempting the API call.");
        console.error(error);
        return false;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error(
          "🔗❌ Error: Test skipped! An error occurred while attempting the API call. Set debugResponseOptions.showRequestError to see details.",
        );
        console.error(`🔗❌ ${axiosError.code} - ${axiosError.message}`);
        return false;
      }

      console.error(
        "🔗❌ Error: Test skipped! An error occurred while attempting the API call. Set debugResponseOptions.showRequestError to see details.",
      );
      return false;
    }

    // General logging and diagnostics
    // TODO: can make this more sophisticated and log the runs to file.
    await responseLoggingAndDiagnostics(
      this.testRunVariables.testRunHash,
      testConfig.name,
      apiResponse,
      this.testRunnerOptions.debugResponseOptions,
    );

    // Validation after the response has come back

    // Check if the statusCode is 200 or the statusCode specified in the testConfig object.
    const expectedStatusCode = testConfig?.validation?.statusCode || 200;
    if (checkStatusCode(apiResponse.status, expectedStatusCode)) {
      console.info(
        `✅ Status Code Check Success! (Got ` +
          "\x1b[36;1m" +
          `${apiResponse.status}` +
          "\x1b[0m" +
          ` as expected${testConfig.validation?.statusCode ? "" : " default"}.)`,
      );
      if (testConfig.variablesToSet) {
        try {
          await setTestRunVariablesFromResponse(this.testRunVariables, testConfig.variablesToSet, apiResponse);
        } catch (e) {
          console.info(`❌❌❌ Error: ${testConfig.name} - Variable Setting Failed!`, e);
          success = false;
        }
      }
    } else {
      console.info(
        `❌❌❌ Error: ${testConfig.name} - Status Code Check Failed! (Expected: ${expectedStatusCode} | Got: ${apiResponse.status})`,
      );
      success = false;
    }

    if (typeof this.dbService !== "undefined") {
      if (testConfig.validation?.tablesToCheck || testConfig.validation?.tablesHaveNoUnexpectedRowCountChanges) {
        // use checkTableRowCountDeltas to check the tablesToCheck array against the tableCountsBefore object.
        if (!(await checkTables(testConfig.validation.tablesToCheck, tableCountsBefore, this.dbService))) {
          success = false;
        }
      }
    }

    if (testConfig.validation?.assertions) {
      // iterate over the assertions array
      for (const assertion of testConfig.validation.assertions) {
        const actualValue = await FetchUtils.getValueFromResponseAndPath(apiResponse, assertion.path, false);
        if (checkAssertion(assertion.path, actualValue, assertion.assertion, true)) {
          console.info(`🛂 ✅ Assertion Success! ${assertion.assertion} for ${assertion.path}.`);
        } else {
          success = false;
        }
      }
    }

    return success;
  }

  public static getPredefinedVariables(): string[] {
    return ["random.number", "random.hash", "dateTime.now", "testRunHash"];
  }

  /**
   * Replaces variables in a string with their corresponding values from a variables object.
   * Variables are denoted in the input string using ${variableName} syntax.
   * Throws an error if a variable key is not found in the variables object.
   * @param testConfigRaw - the input string with variables to replace
   * @param variables - an object with variable key:value pairs
   * @returns JSON parsed string with variables replaced
   */
  public static replaceVariables(testConfigRaw: TestConfig, variables: { [key: string]: string }): TestConfig {
    const rawString = JSON.stringify(testConfigRaw);

    // Yes, probably a way to do this with a single regex, but this works for now.
    // "${variableName:TYPE}" will replace the entire symbol, including the double quotes.
    const stringWithNumbersReplaced = rawString.replace(variableRegexNumber, (match: string, variableKey: string) => {
      // if variableKey is random.number, generate a random number between 0 and 10000 and return it.
      if (variableKey === "random.number") {
        return Math.floor(Math.random() * 10000).toString();
      }

      const variableValue = variables[variableKey];
      // If the variable key is not found in the variables object, throw an error
      if (variableValue === undefined) {
        throw new Error(`Variable "${variableKey}" not found.`);
      }

      // check the typeof variableValue and return it if it is a number or boolean.
      if (typeof variableValue === "number" || typeof variableValue === "boolean") {
        return variableValue;
      }

      // error!
      throw new Error(`Variable "${variableKey}" is not correct type.`);
    });

    // Setting these before the regex so they are constant for any particular test unit.
    const dateNowISOString = getUTCTimeNowString();
    const randomHash = Math.random().toString(36).substring(2, 8);
    const randomNumber = Math.floor(Math.random() * 10000).toString();

    const finalString = stringWithNumbersReplaced.replace(variableRegex, (match: string, variableKey: string) => {
      // if the variableKey is random.hash, generate a random hash of 6 characters and return it.
      if (variableKey === "random.hash") {
        return randomHash;
      }

      // if the variableKey is dateTime.now, return current time ISO string with resolution to seconds.
      if (variableKey === "dateTime.now") {
        return dateNowISOString;
      }

      // if variableKey is random.number, generate a random number between 0 and 10000 and return it.
      if (variableKey === "random.number") {
        return randomNumber;
      }

      const variableValue = variables[variableKey];
      // If the variable key is not found in the variables object, throw an error
      if (variableValue === undefined) {
        throw new Error(`Variable "${variableKey}" not found.`);
      }
      // Return the value of the variable
      return variableValue;
    });

    return JSON.parse(finalString);
  }
}
