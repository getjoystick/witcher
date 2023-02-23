import { TestRunConfig, promptTestRunConfig } from "./chooseConfig.mjs";
import { select } from "@inquirer/prompts";
import { TestFlowControllerService } from "../../services/testFlowControllerService.mjs";

export async function runInteractiveApp() {
  let testRunConfig: TestRunConfig | undefined;

  do {
    let rerunPrevious = false;
    if (testRunConfig) {
      const exitSymbol = Symbol("exit");
      const rerunResponse = await select<boolean | typeof exitSymbol>({
        message: "Would you like to rerun the last test run?",
        choices: [
          {
            name: "Yes",
            value: true,
          },
          {
            name: "No",
            value: false,
          },
          {
            name: "Exit",
            value: exitSymbol,
          },
        ],
      });
      if (rerunResponse === exitSymbol) {
        console.log("Thank you! See you soon!");
        process.exit(0);
      }

      rerunPrevious = rerunResponse;
    }

    if (!testRunConfig || !rerunPrevious) {
      testRunConfig = await promptTestRunConfig();
    }

    const { loader, options, secretLoader } = testRunConfig;

    const testFlowControllerService = new TestFlowControllerService(
      loader,
      secretLoader,
      options,
      promptUserToContinue,
    );

    try {
      await testFlowControllerService.runTests();
    } catch (e) {
      // Intentionally blank.
      // Errors is already displayed by `runTests` – the next iteration will prompt the user to continue.
    }

    // eslint-disable-next-line no-constant-condition
  } while (true);
}

// Prompts user to select whether to continue the test run or not.
async function promptUserToContinue(): Promise<boolean> {
  return select({
    message: "Do you want to continue the test run?",
    choices: [
      {
        name: "Yes",
        value: true,
        description: "Continue the test run.",
      },
      {
        name: "No",
        value: false,
        description: "End the test run.",
      },
    ],
  });
}
