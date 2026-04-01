import { spawnSync } from "node:child_process";

const functions = [
  "upsert-profile",
  "request-match",
  "list-sessions",
  "relay-message",
  "session-action",
  "report-session",
  "respond-invite"
];

for (const name of functions) {
  run("supabase", ["functions", "deploy", name, "--use-api", "--no-verify-jwt"]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
