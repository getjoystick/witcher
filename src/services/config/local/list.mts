import { readdir } from "node:fs/promises";
import path from "node:path";
import { LocalLoader } from "./loader.mjs";

export function getLocalConfigDir(): string {
  return process.cwd();
}

export async function getListOfLocalConfigs(): Promise<Array<{ path: string; name: string; isValid: boolean }>> {
  const testsFolder = getLocalConfigDir();
  const files = await readdir(testsFolder);

  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  const validatedConfigs = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(testsFolder, fileName);
      return {
        name: fileName,
        path: filePath,
        isValid: await new LocalLoader(filePath)
          .loadAndValidateRootConfig()
          .then(() => true)
          .catch(() => false),
      };
    }),
  );

  return validatedConfigs.sort((a, b) => Number(b.isValid) - Number(a.isValid));
}
