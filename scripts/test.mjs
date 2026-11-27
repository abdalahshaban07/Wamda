import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw Error(`${cmd} failed (${r.status})`);
}
function asyncRun(file) {
  return new Promise((done, reject) => {
    const p = spawn(process.execPath, [file], { stdio: "inherit" });
    p.on("close", (code) =>
      code ? reject(Error(`${file} failed (${code})`)) : done(),
    );
    p.on("error", reject);
  });
}
run("npm", ["run", "build"]);
run(process.execPath, [
  "node_modules/typescript/bin/tsc",
  "-p",
  "tsconfig.tests.json",
]);
run(process.execPath, ["--test", "tests/unit-tests.cjs"]);
const server = await startServer();
try {
  const mode = process.argv[2];
  for (const f of mode === "visual"
    ? ["visual"]
    : mode === "motion"
      ? ["motion"]
      : ["e2e", "edge", "axe"])
    await asyncRun(`tests/${f}.cjs`);
} finally {
  await new Promise((done) => server.close(done));
}
