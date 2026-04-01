import { spawnSync } from "node:child_process";

const projectRef = process.env.CLAWBUMP_SUPABASE_PROJECT_REF;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

run("supabase", withProjectRef(["config", "push"]));
run("supabase", withDbPassword(["db", "push", "--linked"]));
run("node", ["./scripts/deploy-functions.mjs"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function withProjectRef(args) {
  return projectRef ? [...args, "--project-ref", projectRef] : args;
}

function withDbPassword(args) {
  return dbPassword ? [...args, "-p", dbPassword] : args;
}
