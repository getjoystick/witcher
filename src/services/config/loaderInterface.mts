import { SetupConfigRaw, TestUnitsConfigRaw } from "src/models/models.mjs";

export interface ConfigLoader {
  loadAndValidateRootConfig(): Promise<SetupConfigRaw>;

  loadTestUnitsConfigs(testUnitConfigs: readonly string[]): Promise<TestUnitsConfigRaw[]>;
}
