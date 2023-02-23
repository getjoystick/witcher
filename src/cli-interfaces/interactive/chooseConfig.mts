import { select, input, password, checkbox } from "@inquirer/prompts";
import { getListOfLocalConfigs } from "../../services/config/local/list.mjs";
import {
  JoystickProfile,
  JoystickConfig,
  JoystickEnvironment,
  getJoystickProfile,
  saveNewConfig,
  saveNewEnvironment,
} from "../../services/config/joystick/profileStorage.mjs";
import { LocalLoader } from "../../services/config/local/loader.mjs";
import { ConfigLoader } from "../../services/config/loaderInterface.mjs";
import JoystickLoader from "../../services/config/joystick/loader.mjs";
import { getListOfSecrets } from "../../services/config/secrets/loader.mjs";
import { SecretsConfigRaw } from "../../models/models.mjs";

enum DataSource {
  Joystick = "joystick",
  Local = "local",
}

export enum Option {
  Interactive = "interactive",
  StopOnFailure = "stopOnFailure",
}

export interface Options {
  [Option.Interactive]: boolean;
  [Option.StopOnFailure]: boolean;
}

export type TestRunConfig = {
  loader: ConfigLoader;
  options: Options;
  secretLoader: SecretConfigLoader;
};

// We return Secret Config Loader instead of config itself, so that we can reload it outside
// of this function, when we need to refresh the secrets (i.e. during the test re-run).
export type SecretConfigLoader = (() => Promise<SecretsConfigRaw>) | undefined;

export async function promptTestRunConfig(): Promise<TestRunConfig> {
  const options = await promptOptions();

  const dataSource = await promptDataSource();
  let loader: ConfigLoader | undefined;

  switch (dataSource) {
    case DataSource.Joystick: {
      const {
        environment: { apiKey },
        config,
      } = await promptJoystickConfig();
      loader = new JoystickLoader(apiKey, config.name);
      break;
    }
    case DataSource.Local: {
      const localFilePath = await promptLocalFilePath();
      loader = new LocalLoader(localFilePath);
      break;
    }
    default:
      throw new Error(`Unknown data source: ${dataSource}`);
  }

  const secretLoader = await promptSecrets();

  return {
    loader,
    options,
    secretLoader,
  };
}

export function promptDataSource(): Promise<string> {
  return select({
    message: "Select data source of your tests:",
    choices: [
      {
        name: "1️⃣  Joystick",
        value: DataSource.Joystick,
        description:
          "Use Joystick-hosted test configs. Joystick is a fast and modern remote configuration & dynamic content platform. Learn more at getjoystick.com!",
      },
      {
        name: "2️⃣  Local file in current working directory",
        value: DataSource.Local,
        description: "Use test configs stored on your computer.",
      },
    ],
  });
}

async function promptLocalFilePath(): Promise<string> {
  const listOfLocalConfigs = await getListOfLocalConfigs();

  return select({
    message: `Select test setup config file:`,
    choices: listOfLocalConfigs.map(({ path, name, isValid }) => ({
      name: `${name} ${isValid ? "✅" : "❌"}`,
      value: path,
    })),
  });
}

async function promptNewEnvironment(): Promise<JoystickEnvironment> {
  const name = await input({
    message: "Enter Environment name:",
    validate: (value) => value.length > 0 && value.length < 50,
  });

  const apiKey = await password({
    message: "Enter API key:",
    validate: (value) => value.length > 0,
  });

  const environment: Omit<JoystickEnvironment, "id"> = {
    name,
    apiKey,
    configs: [],
  };

  const environmentWithId = saveNewEnvironment(environment);

  return environmentWithId;
}

async function promptEnvironment(currentJoystickConfig: JoystickProfile) {
  const newEnvSymbol = Symbol.for("+ Add New Environment");
  let environment: JoystickEnvironment | undefined;
  if (!currentJoystickConfig.environments.length) {
    environment = await promptNewEnvironment();
  } else {
    const envName = await select<string | symbol>({
      message: "Select Environment:",
      choices: [
        ...currentJoystickConfig.environments.map((environmentConfig) => ({
          name: environmentConfig.name,
          value: environmentConfig.name,
        })),
        {
          name: "+ Add New Environment",
          value: newEnvSymbol,
        },
      ],
    });
    if (envName === newEnvSymbol) {
      environment = await promptNewEnvironment();
    } else {
      environment = currentJoystickConfig.environments.find((env) => env.name === envName);
      if (environment === undefined) {
        throw new Error("Environment not found.");
      }
    }
  }

  return environment;
}

async function promptNewConfig(environment: JoystickEnvironment): Promise<JoystickConfig> {
  const name = await input({
    message: "Enter Config Name:",
    validate: (value) => value.length > 0,
  });

  const config = {
    name,
  };

  await saveNewConfig(environment, config);

  return config;
}

/**
 * This method shouldn't exist, once Joystick API will support retrieving list of configs
 * by API key
 * @param environment
 * @returns
 */
async function promptConfig(environment: JoystickEnvironment): Promise<JoystickConfig> {
  const newConfigSymbol = Symbol.for("+ Add New Test Setup Config");
  let config: JoystickConfig | undefined;
  if (environment.configs.length === 0) {
    config = await promptNewConfig(environment);
  } else {
    const configName = await select<string | symbol>({
      message: "Select Test Setup Config:",
      choices: [
        ...environment.configs.map((environmentConfig) => ({
          name: environmentConfig.name,
          value: environmentConfig.name,
        })),
        {
          name: "+ Add New Test Setup Config",
          value: newConfigSymbol,
        },
      ],
    });
    if (configName === newConfigSymbol) {
      config = await promptNewConfig(environment);
    } else {
      config = environment.configs.find((searchConfig) => searchConfig.name === configName);
      // This check is redundant, but TS doesn't know that config is defined
      if (config === undefined) {
        throw new Error("Config not found.");
      }
    }
  }

  return config;
}

async function promptJoystickConfig(): Promise<{ environment: JoystickEnvironment; config: JoystickConfig }> {
  const currentJoystickConfig = getJoystickProfile();
  const environment = await promptEnvironment(currentJoystickConfig);
  const config = await promptConfig(environment);

  return {
    environment,
    config,
  };
}

async function promptOptions(): Promise<Options> {
  const choices = [
    {
      name: "Interactive",
      value: Option.Interactive,
      checked: false,
    },
    {
      name: "Stop on Failure",
      value: Option.StopOnFailure,
      checked: true,
    },
  ];
  const selectedOptions = await checkbox({
    message: "Set Options:",
    choices,
  });

  return choices.reduce((acc, choice) => {
    acc[choice.value] = selectedOptions.includes(choice.value);
    return acc;
  }, {} as Options);
}

async function promptSecrets(): Promise<SecretConfigLoader> {
  let hasSecrets = false;
  let listOfLocalSecrets = [];
  do {
    listOfLocalSecrets = await getListOfSecrets();

    hasSecrets = listOfLocalSecrets.length > 0;

    if (!hasSecrets) {
      const secretsAction = await select({
        message: `No secrets found in ./secrets. Do you want to continue without secrets?`,
        choices: [
          {
            name: "Yes",
            value: "continue",
          },
          {
            name: "Refresh secrets",
            value: "refresh",
          },
          {
            name: "Exit",
            value: "exit",
          },
        ],
      });
      if (secretsAction === "exit") {
        process.exit(0);
      }

      if (secretsAction === "continue") {
        return undefined;
      }
    }
  } while (!hasSecrets);

  return select({
    message: `Select secrets to use from ./secrets (optional):`,
    choices: [
      {
        name: "None",
        value: undefined,
      },
      ...listOfLocalSecrets.map(({ name, isValid, loader }) => ({
        name: `${name} ${isValid ? "✅" : "❌"}`,
        value: loader,
      })),
    ],
  });
}
