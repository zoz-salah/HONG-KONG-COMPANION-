import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL in .env or in the environment.");
  process.exit(1);
}
if (url.startsWith("file:")) {
  const filename = resolve("prisma", url.slice(5).split("?")[0]);
  mkdirSync(dirname(filename), { recursive: true });
  closeSync(openSync(filename, "a"));
}
const run = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
