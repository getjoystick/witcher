import { Joystick } from "@getjoystick/joystick-js";
import { ConfigLoader } from "../loaderInterface.mjs";
import { SetupConfigRaw, TestUnitsConfigRaw } from "src/models/models.mjs";
import setupConfigValidator, { InvalidSetupConfigError } from "../validators/setupConfig.mjs";

export default class JoystickLoader implements ConfigLoader {
  private joystick: Joystick;

  constructor(
    apiKey: string,
    private configName: string,
  ) {
    this.joystick = new Joystick({
      apiKey,
      options: {
        // Every test run should retrieve the latest config
        cacheExpirationSeconds: 0,
      },
    });
  }
  async loadTestUnitsConfigs<TContentId extends string>(testUnitConfigs: TContentId[]): Promise<TestUnitsConfigRaw[]> {
    const configs = await this.joystick.getContents<{
      [K in TContentId]: TestUnitsConfigRaw;
    }>(testUnitConfigs);

    // To make sure the order is the same as the one in the setup config
    // we map the testUnitConfigs array to the configs object (instead of `Object.values(configs)`)
    return testUnitConfigs.map((config) => configs[config]);
  }

  async loadAndValidateRootConfig(): Promise<SetupConfigRaw> {
    const setup = await this.joystick.getContent<SetupConfigRaw>(this.configName);
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
}
