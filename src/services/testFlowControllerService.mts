import { Option, Options, SecretConfigLoader } from "../cli-interfaces/interactive/chooseConfig.mjs";
import { ConfigLoader } from "./config/loaderInterface.mjs";
import { DatabaseConnectionOptions, SetupConfigRaw, StandardizedDatabaseConnectionOptions } from "../models/models.mjs";
import { InvalidSetupConfigError } from "./config/validators/setupConfig.mjs";
import TestRunnerService from "./testRunnerService.mjs";
import { validateConfigsAndExtractTestSet } from "./../services/config/validators/testConfig.mjs";
import DatabaseServiceInterface from "./db/databaseServiceInterface.mjs";
import Postgres from "./db/postgres.mjs";
import Mysql from "./db/mysql.mjs";
import { PROJECT_EMOJIS } from "./const/formatting.mjs";
import fs from "node:fs";

interface TestExecutionResult {
  success: boolean;
}

export class TestFlowControllerService {
  public constructor(
    private configLoader: ConfigLoader,
    private secretsLoader: SecretConfigLoader,
    private options: Options,
    private promptUserToContinue: () => Promise<boolean>,
  ) {}

  public async runTests(): Promise<TestExecutionResult> {
    this.displayOptions();
    // Load the config file.
    let testSetupConfigParsed: SetupConfigRaw | undefined;
    try {
      testSetupConfigParsed = await this.configLoader.loadAndValidateRootConfig();
    } catch (e) {
      if (e instanceof InvalidSetupConfigError) {
        console.error(`    🛑 Setup config validation failed:`);
        e.errors?.forEach((error) => {
          console.error(error);
        });
      }

      console.error("\n🤕 Oh no! There was an error loading the test setup config");

      return { success: false };
    }

    try {
      return { success: await this.runTestLogic(testSetupConfigParsed) };
    } catch (error) {
      console.log("\n🤕 Oh no! There was an error running the test: ");
      console.log(error);
      throw error;
    }
  }

  private displayOptions() {
    // Check for options.
    if (this.options[Option.Interactive]) {
      console.log("👀  Interactive mode enabled; will pause between each Test Unit.");
    }
    if (this.options[Option.StopOnFailure]) {
      console.log("👀  Stop on fail enabled; any Test Unit failure will stop the test run.");
    }
  }

  private async standardizeDbOptions(
    databaseConnectionOptions: DatabaseConnectionOptions,
  ): Promise<StandardizedDatabaseConnectionOptions> {
    let result = { ...databaseConnectionOptions };
    if ("sslCertificatePath" in databaseConnectionOptions) {
      const sslCertificatePath = databaseConnectionOptions.sslCertificatePath;
      if (sslCertificatePath) {
        const sslCertificate = (await fs.promises.readFile(sslCertificatePath)).toString();
        result = {
          ...databaseConnectionOptions,
          sslCertificate,
        };
      }
    }
    return result;
  }

  private async runTestLogic(setupConfig: SetupConfigRaw): Promise<boolean> {
    const setupConfigEnrichedWithSecrets = {
      ...setupConfig,
      ...(this.secretsLoader ? await this.secretsLoader() : {}),
    };

    console.log("Start Test Run..........................................................");

    // Setup the initial variables for the test run.
    const initialVariables: string[] = [];
    if (setupConfigEnrichedWithSecrets.initialTestRunVariables) {
      Object.keys(setupConfigEnrichedWithSecrets.initialTestRunVariables).forEach((variable) => {
        initialVariables.push(variable);
      });
    }

    const testUnitConfigsNoExtension = setupConfigEnrichedWithSecrets.testUnitsConfigs.map((config) =>
      config.replace(/\.json$/, ""),
    );

    const testUnitConfigs = await this.configLoader.loadTestUnitsConfigs(testUnitConfigsNoExtension);
    const testSet = validateConfigsAndExtractTestSet(testUnitConfigs, initialVariables);

    // Check if setupConfig.databaseConnectionOptions is set, if so, connect to the database.
    let dbService: DatabaseServiceInterface | undefined = undefined;

    const dbOptions = setupConfigEnrichedWithSecrets?.databaseConnectionOptions;

    if (dbOptions) {
      const standardizedDbOptions = await this.standardizeDbOptions(dbOptions);
      if (standardizedDbOptions.dbms === "postgresql") {
        dbService = new Postgres();
      } else if (standardizedDbOptions.dbms === "mysql") {
        dbService = new Mysql();
      } else {
        console.log(`\n`);
        console.log(`    ------------------------------------`);
        console.log(`    🛑 Ending Test Run: Database "${standardizedDbOptions.dbms}" is not supported.`);
        return false;
      }
      await dbService.connect(standardizedDbOptions);
    }

    // Initialize a Test Runner with dbService and initialTestRunVariables
    const myTestRunner = new TestRunnerService(
      dbService,
      setupConfigEnrichedWithSecrets?.initialTestRunVariables,
      setupConfigEnrichedWithSecrets?.testRunnerOptions,
    );

    const successfulTests: string[] = [];
    const failedTests: string[] = [];
    let skippedTests: string[] = [];

    // Run the tests
    for (const testConfig of testSet) {
      if (await myTestRunner.runTest(testConfig)) {
        successfulTests.push(testConfig.name);
      } else {
        if (this.options[Option.StopOnFailure]) {
          console.log(`\n`);
          console.log(`    ------------------------------------`);
          console.log(`    🛑 Ending Test Run: Test "${testConfig.name}" failed.`);
          return false;
        }
        failedTests.push(testConfig.name);
      }
      if (this.options[Option.Interactive] && !(await this.promptUserToContinue())) {
        // user wants to stop the run
        skippedTests = testSet
          .map((test) => test.name)
          .filter((testName) => !successfulTests.includes(testName) && !failedTests.includes(testName));
        break;
      }
    }

    const status = {
      dbAvailable: !!dbService,
    };

    this.printReport(successfulTests, failedTests, skippedTests, status);
    console.log("\n   📋  Test Run Finished  📋");

    return failedTests.length == 0;
  }

  // Print a report of the test run.
  private printReport(
    successfulTests: string[],
    failedTests: string[],
    skippedTests: string[],
    status: { [key: string]: unknown } = {},
  ) {
    console.log(`\n\n   ${PROJECT_EMOJIS}  Test Report  ${PROJECT_EMOJIS}`);
    console.log("   ------------------------------------");
    console.log(`   📋  Total Tests.....${successfulTests.length + failedTests.length}`);
    console.log(`   ✅  Successful......${successfulTests.length}`);
    console.log(`   ❌  Failed..........${failedTests.length}`);
    if (skippedTests.length > 0) {
      console.log(`   🟡  Skipped.........${skippedTests.length}`);
    }
    console.log("   ------------------------------------");

    if (!status.dbAvailable) {
      console.log("   🟡  Database not setup for this test run.");
      console.log("   ------------------------------------");
    }

    if (failedTests.length == 0) {
      console.log("   🎉  All attempted tests passed!");
      console.log("   ------------------------------------");
    }

    if (skippedTests.length > 0) {
      console.log("   🟡  Skipped Tests:");
      for (const skippedTest of skippedTests) {
        console.log(`   - ${skippedTest}`);
      }
      console.log("   ------------------------------------");
    }

    if (failedTests.length > 0) {
      console.log("   ❌  Failed Tests:");
      for (const failedTest of failedTests) {
        console.log(`   - ${failedTest}`);
      }
      console.log("   ------------------------------------");
    }
  }
}
