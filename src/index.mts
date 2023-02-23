#!/usr/bin/env node

import { runInteractiveApp } from "./cli-interfaces/interactive/runner.mjs";
import { runNonInteractiveApp } from "./cli-interfaces/non-interactive/runner.mjs";
import { PROJECT_EMOJIS } from "./services/const/formatting.mjs";

console.log(`\n${PROJECT_EMOJIS}  Welcome to Witcher API Test Runner!`);

if (process.argv.length > 2) {
  runNonInteractiveApp();
} else {
  runInteractiveApp().catch(console.error);
}
