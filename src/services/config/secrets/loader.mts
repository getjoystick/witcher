import { readdir } from "fs/promises";
import { getLocalConfigDir } from "../local/list.mjs";
import path, { dirname } from "path";
import { secretsConfigValidator } from "../validators/secretsConfig.mjs";
import stripJsonComments from "strip-json-comments";
import fs from "fs/promises";

import { InvalidSetupConfigError } from "../validators/setupConfig.mjs";
import { SecretsConfigRaw } from "src/models/models.mjs";

export function getSecretsConfigDir() {
  return path.join(getLocalConfigDir(), "secrets");
}
export async function getListOfSecrets() {
  const secretsFolder = getSecretsConfigDir();

  const folderIsAvailable = await fs
    .access(secretsFolder, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (!folderIsAvailable) {
    return [];
  }

  const files = await readdir(secretsFolder);

  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  const validatedConfigs = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(secretsFolder, fileName);
      const loadSecretFn = () => loadAndValidateSecret(filePath);
      const loadSecretPromise = loadSecretFn();
      const secretIsValid = await loadSecretPromise.then(() => true).catch(() => false);
      return {
        name: fileName,
        path: filePath,
        isValid: secretIsValid,
        secretPromise: loadSecretPromise,
        loader: loadSecretFn,
      };
    }),
  );

  return validatedConfigs.sort((a, b) => Number(b.isValid) - Number(a.isValid));
}

export async function loadAndValidateSecret(secretFilePath: string) {
  const setup = JSON.parse(stripJsonComments(await fs.readFile(secretFilePath, "utf-8")));
  if (!secretsConfigValidator(setup)) {
    throw new InvalidSetupConfigError(
      `Secrets config validation failed.`,
      secretsConfigValidator.errors?.map((error) => {
        return `${error.instancePath} ${error.message}`;
      }) || [],
    );
  }

  const setupTyped = setup as SecretsConfigRaw;

  const secretsDir = dirname(secretFilePath);

  // Replace with absolute path
  const { sslCertificatePath } = setupTyped.databaseConnectionOptions;
  setupTyped.databaseConnectionOptions.sslCertificatePath = sslCertificatePath
    ? path.join(secretsDir, sslCertificatePath)
    : undefined;

  return setupTyped;
}
