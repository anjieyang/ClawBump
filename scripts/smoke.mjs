import { runSmoke } from "./smoke-runner.mjs";

runSmoke().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
