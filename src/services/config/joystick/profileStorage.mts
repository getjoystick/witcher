import { homedir } from "node:os";
import fs from "node:fs";
import path from "node:path";

export type JoystickConfig = {
  name: string;
};
export type JoystickEnvironment = {
  id: number;
  name: string;
  apiKey: string;
  configs: JoystickConfig[];
};
export type JoystickProfile = {
  environments: JoystickEnvironment[];
};

const PROJECT_DIR_NAME = `.witcher`;

function prepareJoystickConfigFile() {
  const homeDirectory = homedir();

  const projectDir = path.join(homeDirectory, PROJECT_DIR_NAME);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir);
  }

  const joystickConfigFile = path.join(projectDir, "/.joystick.json");

  if (!fs.existsSync(joystickConfigFile)) {
    fs.writeFileSync(joystickConfigFile, JSON.stringify({ environments: [] }));
  }

  return joystickConfigFile;
}
export function getJoystickProfile(): JoystickProfile {
  return JSON.parse(fs.readFileSync(prepareJoystickConfigFile(), "utf-8"));
}

export function writeJoystickProfile(config: JoystickProfile) {
  fs.writeFileSync(prepareJoystickConfigFile(), JSON.stringify(config));
}

export function saveNewEnvironment(env: Omit<JoystickEnvironment, "id">) {
  const joystickConfig = getJoystickProfile();
  const envTracked = {
    ...env,
    id: Math.max(...joystickConfig.environments.map((env) => env.id), 0) + 1,
  };
  joystickConfig.environments.push(envTracked);

  writeJoystickProfile(joystickConfig);

  return envTracked;
}

export function saveNewConfig(saveToEnv: JoystickEnvironment, config: JoystickConfig) {
  const joystickConfig = getJoystickProfile();
  const environmentInx = joystickConfig.environments.findIndex((env) => env.id === saveToEnv.id);

  if (environmentInx === -1) {
    throw new Error(`Environment with id ${saveToEnv.id} not found`);
  }

  joystickConfig.environments[environmentInx].configs = [
    ...joystickConfig.environments[environmentInx].configs,
    config,
  ];

  writeJoystickProfile(joystickConfig);
}
