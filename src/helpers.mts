// import the response type from axios since the global Response type won't work.
import DatabaseServiceInterface from "./services/db/databaseServiceInterface.mjs";
import { TableToCheck, PathToVariableMap, DebugResponseOptions, ParsedValue } from "./models/models.mjs";
import { AxiosResponse } from "axios";

type Path = (string | number)[];

export const variableRegex = /\${\s*([^}\s]+)\s*}/g;
export const variableRegexNumber = /"\${\s*([^}\s]+)\s*:\s*(number|boolean)\s*}"/g;
export const variableRegexFullSyntax = /\${\s*([^}\s]+)(\s*:\s*(number|boolean))?\s*}/g;
export class FetchUtils {
  /**
   * Navigates an object using a given path.
   *
   * @param obj The object to navigate.
   * @param path The path to navigate.
   * @returns The value at the given path, or `undefined` if the path is invalid.
   */
  private static getByPath(obj: any, path: Path) {
    let current = obj;
    for (const component of path) {
      current = current[component];
      if (current === undefined) {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Gets a value from a axios response object.
   *
   * @param axiosResponse The axios response object to get the value from.
   * @param path The path to the value. The path must start with either "responseHeader" or "responseBody".
   * If the path starts with "responseHeader", expecting only two parts. responseHeader.<headerName>
   * If the path starts with "responseBody", the value will be treated as a path within the response body JSON.
   * Either of the following paths are valid:
   * responseBody[1].a.b[0].c OR responseBody.1.a.b.0.c
   * @param assertPathExists if true - will throw an error if the path doesn't exist. If false - will return undefined if the path doesn't exist.
   * @returns The value at the given path, or `null` if the path is invalid.
   * @throws An error if the path type is invalid or if an undefined value is encountered during navigation of the response body.
   */
  static getValueFromResponseAndPath<T>(
    axiosResponse: AxiosResponse,
    path: string,
    assertPathExists: boolean,
  ): T | null {
    // check if the path string begins with "responseHeader" or "responseBody"
    const type = path.startsWith("responseHeader")
      ? "responseHeader"
      : path.startsWith("responseBody")
      ? "responseBody"
      : null;

    if (type === "responseHeader") {
      const parts = path.split(".");
      const headerValue = axiosResponse.headers[parts[1]];
      if (headerValue == undefined) {
        throw new Error(`Response header '${parts[1]}' is not present.`);
      }
      return headerValue as unknown as T;
    } else if (type === "responseBody") {
      // If the path starts with "responseBody", get the JSON response body and navigate to the specified path. Error will be thrown if the path is invalid.
      const responseBody = axiosResponse.data;
      const rootPath = "responseBody";

      // If it is just the "responseBody" as the path, then return the entire response body
      if (path === rootPath) return responseBody as unknown as T;
      //  Either of the following paths are valid:
      //  responseBody[1].a.b[0].c => ["responseBody", 1, "a", "b", 0, "c"]
      //  responseBody.1.a.b.0.c => ["responseBody", 1, "a", "b", 0, "c"]

      const pathComponents: Path = path.split(".").flatMap((component) => {
        const isDigit = /^\d+$/.test(component);
        const matchArrayComponent = component.match(/(.+)\[(\d+)\]/); // matching array name with index "abc[0]"

        if (isDigit) {
          // If the component is a number, parse it as an integer
          return parseInt(component, 10);
        } else if (matchArrayComponent) {
          // If the component is an array index, parse it as an array index
          return [matchArrayComponent[1], parseInt(matchArrayComponent[2], 10)];
        } else {
          return component;
        }
      });

      // console.log(pathComponents); // Debug

      // Remove the "responseBody" path component
      pathComponents.shift();

      let value: undefined | any = undefined;

      try {
        value = FetchUtils.getByPath(responseBody, pathComponents);
      } catch (error) {
        throw new Error(`No value found at '${path}'`);
      }
      // If the value in undefined throw an error
      if (assertPathExists && value === undefined) {
        throw new Error(`Value at path '${path}' is undefined`);
      }
      return value;
    } else {
      throw new Error(`Invalid path type '${type}'`);
    }
  }
}

export const responseLoggingAndDiagnostics = (
  testRunHash: string,
  testName: string,
  response: AxiosResponse,
  debugResponseOptions: DebugResponseOptions,
): void => {
  // TODO: Pass in the endpoint / request information as well so we have the complete info to log.

  const SHOW_BODY = debugResponseOptions.showBody;
  const SHOW_HEADERS = debugResponseOptions.showHeaders;
  const SHOW_STATUS = debugResponseOptions.showStatusCode;

  // TODO: Option to handle if response back is not JSON.
  // let responseBodyRaw = await response.text();
  // let responseBody = JSON.parse(responseBodyRaw);

  const responseBody = response.data;

  // if any of the constants above are true, emit a log
  if (SHOW_STATUS || SHOW_BODY || SHOW_HEADERS) {
    console.log(`🔍🔍🔍 ${testRunHash} - Diagnostic Information`);
  }

  if (SHOW_STATUS) {
    console.log(`\n🔍  ${testRunHash} - ${testName} Status: `, response.status);
  }

  if (SHOW_BODY) {
    console.log(`\n🔍  ${testRunHash} - ${testName} Body: `);
    console.log(responseBody);
  }

  if (SHOW_HEADERS) {
    console.log(`\n🔍  ${testRunHash} - ${testName} Headers: `);
    for (const [key, value] of Object.entries(response.headers)) {
      console.log(`🔍  ${key}: ${value}`);
    }
  }

  if (SHOW_STATUS || SHOW_BODY || SHOW_HEADERS) {
    console.log(`\n🔍🔍🔍 END Diagnostic Information\n`);
  }

  // TODO: Do something with the response header and body. Save to run log, etc
};

// a function that sets the testRunVariables using an AxiosResponse and a PathToVariableMap
export const setTestRunVariablesFromResponse = (
  testRunVariables: { [key: string]: any },
  pathToVariableMap: PathToVariableMap[],
  response: AxiosResponse,
) => {
  for (const map of pathToVariableMap) {
    // if map.variableName is 'testRunHash' then do not set it. Reserved.
    if (map.variableName === "testRunHash") continue;

    testRunVariables[map.variableName] = FetchUtils.getValueFromResponseAndPath(response, map.path, true);

    // if testRunVariables[map.variableName] is longer than 20 characters, truncate it and add ...
    const variableConsoleLogDisplay =
      testRunVariables[map.variableName].toString().length > 20
        ? testRunVariables[map.variableName].toString().substring(0, 20) + "..."
        : testRunVariables[map.variableName].toString();

    // console log the variable name and value
    console.log(`📌 '${map.variableName}' SET AS: ${variableConsoleLogDisplay}`);
  }
};

export const checkTables = async (
  tablesToCheck: TableToCheck[] | undefined,
  tableCountsBefore: {
    tableName: string;
    schemaName?: string;
    count: number;
  }[],
  dbService: DatabaseServiceInterface,
): Promise<boolean> => {
  let allTablesPassed = true;
  let validateAllTables = false;
  for (const tableCountBefore of tableCountsBefore) {
    // Has the table to check been explicitly specified?
    const tableToCheck = tablesToCheck?.find((t) => t.tableName === tableCountBefore.tableName);

    if (tableToCheck) {
      // Check the explicitly specified table.

      // Check the table count deltas are what is expected.
      if (
        tableToCheck?.expectedRowCountChange !== undefined &&
        !(await checkTableRowCountDelta(tableToCheck, tableCountBefore.count, dbService))
      ) {
        allTablesPassed = false;
      }

      // Check if the row-level checks are what is expected.
      if (tableToCheck?.rowChecks !== undefined && !(await checkTableRows(tableToCheck, dbService))) {
        allTablesPassed = false;
      }
    } else {
      // If there is a table that has not been specified, and it is present on tableCountBefore, it means we have tablesHaveNoUnexpectedRowCountChanges: true.
      validateAllTables = true;
      // Make sure that the table count delta is 0 on tables not explicitly specified.
      if (
        !(await checkTableRowCountDelta(
          {
            tableName: tableCountBefore.tableName,
            schemaName: tableCountBefore.schemaName,
            expectedRowCountChange: 0,
          },
          tableCountBefore.count,
          dbService,
          false,
        ))
      ) {
        allTablesPassed = false;
      }
    }
  }
  if (validateAllTables && allTablesPassed) {
    console.info(`🗄️  ✅  🟦 All tables checked. No unexpected row count changes in any database tables.`);
  }

  return allTablesPassed;
};

export const checkTableRows = async (
  tableToCheck: TableToCheck,
  dbService: DatabaseServiceInterface,
): Promise<boolean> => {
  let allRowsPassed = true;

  if (!tableToCheck.rowChecks) {
    throw new Error(`Table '${tableToCheck.tableName}' has no rowChecks defined.`);
  }

  for (const rowCheck of tableToCheck.rowChecks) {
    // Get rows from the DB that match the table name and the queryFilter. queryFilter is optional. If not passed, then all rows from the specified tableName are returned.
    const rows = await dbService.getRowsByFilter(tableToCheck.tableName, rowCheck.queryFilter, tableToCheck.schemaName);

    // Able to make an assertion on the count of rows that are returned.
    if (rowCheck?.rowCountAssertion !== undefined) {
      const message = `Table '${tableToCheck.tableName}': row count with filter '${JSON.stringify(
        rowCheck.queryFilter,
      )}' is '${rows.length}'. Expecting '${rowCheck.rowCountAssertion}'`;

      if (checkAssertion(`DB.${tableToCheck.tableName}.rowCount`, rows.length, rowCheck.rowCountAssertion, false)) {
        console.info(`🗄️  ✅ ${message}`);
      } else {
        console.error(`🗄️  ❌ ${message}`);
        allRowsPassed = false;
      }
    } else if (rows.length === 0) {
      console.error(
        `🗄️  ❌ Table '${tableToCheck.tableName}': row with filter '${JSON.stringify(rowCheck.queryFilter)}' not found`,
      );
      return false;
    }

    // For each row that is returned, if rows are returned, check the column values match the assertions.
    if (rowCheck?.columnChecks !== undefined) {
      for (const row of rows) {
        Object.entries(rowCheck.columnChecks).forEach(([columnName, assertion]) => {
          const message = `Table '${tableToCheck.tableName}': with filter '${JSON.stringify(
            rowCheck.queryFilter,
          )}': has column ${columnName} expecting '${assertion}'. Actual value: '${row[columnName]}'`;

          if (!checkAssertion(`DB.${tableToCheck.tableName}.${columnName}`, row[columnName], assertion, false)) {
            console.error(`🗄️  ❌ ${message}`);
            allRowsPassed = false;
          } else {
            console.info(`🗄️  ✅ ${message}`);
          }
        });
      }
    }
  }
  return allRowsPassed;
};

// Go through the tables and check that the row count changed by the expected amount
export const checkTableRowCountDelta = async (
  tableToCheck: TableToCheck,
  tableCountBefore: number,
  dbService: DatabaseServiceInterface,
  printLog = true,
): Promise<boolean> => {
  const currentCount = await dbService.countRows(tableToCheck.tableName, tableToCheck.schemaName);
  const actualDelta = currentCount - tableCountBefore;

  // show the current count and table count before
  // Silent when used for checking all tables.
  if (printLog)
    console.info(`🗄️  Table '${tableToCheck.tableName}': Before: ${tableCountBefore} After: ${currentCount}`);
  if (actualDelta !== tableToCheck.expectedRowCountChange) {
    console.error(
      `🗄️  ❌ Table '${tableToCheck.tableName}': row count did not change by ${tableToCheck.expectedRowCountChange} as expected. Actual change: ${actualDelta}`,
    );
    return false;
  } else {
    if (printLog)
      console.info(`🗄️  ✅ Table '${tableToCheck.tableName}': row count changed by ${actualDelta} as expected.`);
  }

  return true;
};

const lengthAssertionRegex = /^length\s*(>=|<=|>|<|=|!=)\s*(\d+)$/;
const typeAssertionRegex = /^typeof\s*(string|number|boolean|object|array|null)$/;
const operatorAssertionRegex = /^value\s*(>=|<=|>|<|=|!=)\s*('?.*'?)$/;

export const validateAssertion = (path: string, assertion: string): void => {
  if (assertion === "exists") {
    return;
  }
  const lengthRegexMatch = assertion.match(lengthAssertionRegex);
  if (lengthRegexMatch) {
    return;
  }
  const typeRegexMatch = assertion.match(typeAssertionRegex);
  if (typeRegexMatch) {
    return;
  }
  const operatorRegexMatch = assertion.match(operatorAssertionRegex);
  if (operatorRegexMatch) {
    const operator = operatorRegexMatch[1];
    const secondValue = parseValue(operatorRegexMatch[2]);
    assertValueComparableByOperator(path, secondValue, operator);
    return;
  }

  throw new Error(`Error: assertion with path=${path} and assertion=${assertion} is not valid.`);
};

// Asserts that the value at the path corresponds to the assertion. We support the following assertions:
// - exists: the value at the path must exist
// - length [<,>,<=,>=,=,!=] X: the length of the value at the path must match the comparison against X
// - value [<,>,<=,>=,=,!=] X: the value at the path must match the comparison against X
// - typeof [string, number, boolean, object, array, null]: the type of the value at the path must match the comparison
export const checkAssertion = (path: string, value: any, assertion: string, printErrorMessage: boolean): boolean => {
  // check if "exists" syntax is used and if so, check that the value exists
  if (assertion === "exists") {
    return checkOperationForPath(path, value, "exists", undefined, printErrorMessage);
  }
  // check if "length" syntax is used using regex and if so, check that the length of the value matches the assertion
  const lengthRegexMatch = assertion.match(lengthAssertionRegex);
  if (lengthRegexMatch) {
    const operator = lengthRegexMatch[1];
    const secondValue = parseInt(lengthRegexMatch[2]);
    return checkOperationForPath(path, value?.length, operator, secondValue, printErrorMessage);
  }
  // check if "typeof" syntax is used using regex and if so, check that the type of the value matches the assertion
  const typeRegexMatch = assertion.match(typeAssertionRegex);
  if (typeRegexMatch) {
    const type = typeRegexMatch[1];
    if (type === "array") {
      return Array.isArray(value);
    }
    return checkOperationForPath(path, typeof value, "=", type, printErrorMessage);
  }
  // check if "value" syntax is used using regex and if so, check that the value matches the assertion
  const operatorRegexMatch = assertion.match(operatorAssertionRegex);
  if (operatorRegexMatch) {
    const operator = operatorRegexMatch[1];
    const secondValue = parseValue(operatorRegexMatch[2]);
    return checkOperationForPath(path, value, operator, secondValue, printErrorMessage);
  }

  throw new Error(`Error: assertion with path=${path} and assertion=${assertion} is not valid.`);
};

// asserts that value can be compared using [>=, <=, >, <] operators
function assertValueComparableByOperator(path: string, value: any, operator: string): asserts value is number | string {
  if ([">=", "<=", "<", ">"].indexOf(operator) > -1 && ["number", "string"].indexOf(typeof value) === -1) {
    throw new Error(
      `Error: assertion with path=${path} is invalid. Value ${value} is not comparable using operator ${operator}`,
    );
  }
}

// a function that asserts that path in the response matches a math operator
function checkOperationForPath(
  path: string,
  value: any,
  operator: string,
  secondValue: ParsedValue,
  printErrorMessage: boolean,
): boolean {
  const errorMessagePrefix = `🛂 ❌ Assertion Failed for "${path}":`;

  assertValueComparableByOperator(path, secondValue, operator);
  switch (operator) {
    case "exists":
      if (value === undefined) {
        if (printErrorMessage) {
          console.error(`${errorMessagePrefix} Expecting response to have a value at this location.`);
        }
        return false;
      }
      break;
    case ">=":
      if (value < secondValue) {
        if (printErrorMessage) {
          console.error(`${errorMessagePrefix} Responded with ${value}. Expecting response less than ${secondValue}.`);
        }
        return false;
      }
      break;
    case "<=":
      if (value > secondValue) {
        if (printErrorMessage) {
          console.error(
            `${errorMessagePrefix} Responded with ${value}. Expecting response greater than ${secondValue}.`,
          );
        }
        return false;
      }
      break;
    case ">":
      if (value <= secondValue) {
        if (printErrorMessage) {
          console.error(
            `${errorMessagePrefix} Responded with ${value}. Expecting response less than or equal to ${secondValue}.`,
          );
        }
        return false;
      }
      break;
    case "<":
      if (value >= secondValue) {
        if (printErrorMessage) {
          console.error(
            `${errorMessagePrefix} Responded with ${value}. Expecting response greater than or equal ${secondValue}.`,
          );
        }
        return false;
      }
      break;
    case "=":
      if (value !== secondValue) {
        if (printErrorMessage) {
          console.error(`${errorMessagePrefix} Responded with ${value}. Expecting response to equal ${secondValue}.`);
        }
        return false;
      }
      break;
    case "!=":
      if (value === secondValue) {
        if (printErrorMessage) {
          console.error(
            `${errorMessagePrefix} Responded with ${value}. Expecting response NOT equal to ${secondValue}.`,
          );
        }
        return false;
      }
      break;
    case "typeof":
      if (value !== secondValue) {
        if (printErrorMessage) {
          console.error(`${errorMessagePrefix} Value is of type ${value}. Expecting type ${secondValue}.`);
        }
        return false;
      }
      break;
    default:
      throw new Error(`Error in assertion with path ${path}: Unknown assertion operator '${operator}'`);
  }
  return true;
}

// Parses a value from string. We support only boolean, number and string
export const parseValue = (value: string): ParsedValue => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (!isNaN(Number(value))) {
    return Number(value);
  }
  if (value.match(/^'.*'$/)) {
    return value.substring(1, value.length - 1);
  }
  throw new Error(`Error: Value ${value} is not a valid value. Maybe you need to add single quotes?`);
};

export const getUTCTimeNowString = (): string => {
  const now = new Date();
  return now.toISOString().substring(0, 19) + "Z";
};

export const checkStatusCode = (statusCode: number, expectedStatusCode: number | string[]): boolean => {
  if (typeof expectedStatusCode === "number") {
    return statusCode === expectedStatusCode;
  } else {
    for (const range of expectedStatusCode) {
      const [from, to] = range.split("-");
      if (statusCode >= parseInt(from) && statusCode <= parseInt(to)) {
        return true;
      }
    }
    return false;
  }
};
