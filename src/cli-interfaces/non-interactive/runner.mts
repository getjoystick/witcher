import { LocalLoader } from "../../services/config/local/loader.mjs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Option } from "../interactive/chooseConfig.mjs";
import { TestFlowControllerService } from "../../services/testFlowControllerService.mjs";
import { loadAndValidateSecret } from "../../services/config/secrets/loader.mjs";
import JoystickLoader from "../../services/config/joystick/loader.mjs";
import { ConfigLoader } from "src/services/config/loaderInterface.mjs";

const options = {
  [Option.Interactive]: false,
  [Option.StopOnFailure]: true,
};

async function runTests(configLoader: ConfigLoader, secretPath: string | undefined) {
  const secretsLoader = secretPath !== void 0 ? () => loadAndValidateSecret(secretPath) : undefined;

  const testFlowControllerService = new TestFlowControllerService(configLoader, secretsLoader, options, () => {
    throw new Error("Attempt to prompt user in non-interactive mode");
  });

  const result = await testFlowControllerService.runTests();

  if (!result.success) {
    throw new Error("Test execution is failed");
  }
}

export function runNonInteractiveApp() {
  yargs(hideBin(process.argv))
    .command(
      "local <rootConfigPath>",
      "Use test configs stored on your computer.",
      (yargs) => {
        return yargs
          .option("secret", {
            alias: "s",
            type: "string",
            demandOption: false,
            description: "Path to the secrets file",
          })
          .positional("rootConfigPath", {
            type: "string",
            demandOption: true,
            description: "Path to the root config file",
          });
      },
      async (argv) => {
        await runTests(new LocalLoader(argv.rootConfigPath), argv.secret);
      },
    )
    .command(
      "joystick",
      "Use Joystick-hosted test configs. Joystick is a fast and modern remote configuration & dynamic content platform. Learn more at getjoystick.com!",
      (yargs) => {
        return yargs
          .option("apiKey", {
            alias: "a",
            type: "string",
            demandOption: true,
            description: "Joystick API key",
          })
          .option("configId", {
            alias: "c",
            type: "string",
            demandOption: true,
            description: "Joystick config ID",
          })
          .option("secret", {
            alias: "s",
            type: "string",
            demandOption: false,
            description: "Path to the secrets file",
          });
      },
      async (argv) => {
        await runTests(new JoystickLoader(argv.apiKey, argv.configId), argv.secret);
      },
    )
    .fail(function (msg) {
      if (msg) {
        console.log("Error: ", msg);
      }

      process.exit(1);
    })
    .demandCommand(1)
    .help()
    .parse();
}
