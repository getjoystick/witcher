import { SetupConfigRaw, TestUnitsConfigRaw } from "src/models/models.mjs";
import { ConfigLoader } from "../loaderInterface.mjs";
import fs from "fs/promises";
import stripJsonComments from "strip-json-comments";
import setupConfigValidator, { InvalidSetupConfigError } from "../validators/setupConfig.mjs";
import path from "path";

export class LocalLoader implements ConfigLoader {
  public constructor(private readonly localFilePath: string) {}

  private getTestsFolder() {
    return path.resolve(path.dirname(this.localFilePath));
  }

  async loadAndValidateRootConfig(): Promise<SetupConfigRaw> {
    // Let's validate the setup config before the run.
    const testSetupConfigParsed = await this.getValidSetupConfig(this.localFilePath);

    return testSetupConfigParsed;
  }

  private async getValidSetupConfig(path: string) {
    const setup = JSON.parse(stripJsonComments(await fs.readFile(path, "utf-8")));
    if (!setupConfigValidator(setup)) {
      throw new InvalidSetupConfigError(
        `Setup config validation failed.`,
        setupConfigValidator.errors?.map((error) => {
          return `${error.instancePath} ${error.message}`;
        }) || [],
      );
    }
    return setup as SetupConfigRaw;
  }

  public async loadTestUnitsConfigs(testUnitConfigsFileName: string[]): Promise<TestUnitsConfigRaw[]> {
    const cleanPathToTestUnitsConfigs = testUnitConfigsFileName.map((config) => config.replace(".json", ""));

    const testsFolder = this.getTestsFolder();
    const promises = cleanPathToTestUnitsConfigs.map(async (testFileName) => {
      const absolutePath = path.join(testsFolder, `${testFileName}.json`);
      return JSON.parse(stripJsonComments(await fs.readFile(absolutePath, "utf-8")));
    });

    const configs = await Promise.all(promises);

    return configs as TestUnitsConfigRaw[];
  }
}
