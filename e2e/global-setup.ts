import { execSync } from "node:child_process";

/** Every run starts from the same seeded demo data, so journeys that change state are repeatable. */
export default function globalSetup() {
  execSync("node --conditions=react-server --env-file=.env.local --import tsx scripts/seed.ts", { stdio: "inherit", env: { ...process.env, AI_STUB: "1" } });
}
