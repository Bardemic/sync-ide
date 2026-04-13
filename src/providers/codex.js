import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BUNDLED_CODEX_CLI = "/Applications/Codex.app/Contents/Resources/codex";

export const codexProvider = {
  name: "codex",
  aliases: ["codex-desktop"],
  description: "OpenAI Codex Desktop",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }

    const cli = resolveCodexCli();
    if (!cli) {
      throw new Error(
        "Could not find the `codex` CLI. Install it via `brew install codex`, install Codex.app, or add it to PATH.",
      );
    }

    const result = spawnSync(cli, ["app", workspaceRoot], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`\`codex app\` exited with ${result.status}.`);
    }
    console.log(`Opened ${workspaceRoot} in Codex Desktop.`);
  },
};

function resolveCodexCli() {
  const onPath = spawnSync("which", ["codex"], { encoding: "utf8" });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  if (existsSync(BUNDLED_CODEX_CLI)) return BUNDLED_CODEX_CLI;
  return null;
}
