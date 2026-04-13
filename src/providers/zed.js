import { existsSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const BUNDLED_ZED_CLI_MAC = "/Applications/Zed.app/Contents/MacOS/cli";

export const zedProvider = {
  name: "zed",
  aliases: [],
  description: "Zed editor",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }

    const cli = resolveZedCli();
    if (!cli) {
      throw new Error(
        "Could not find the `zed` CLI. Install Zed and run `zed: install cli` from the command palette, or add Zed.app to /Applications.",
      );
    }

    spawn(cli, [workspaceRoot], { detached: true, stdio: "ignore" }).unref();
    console.log(`Opened ${workspaceRoot} in Zed.`);
  },
};

function resolveZedCli() {
  const onPath = spawnSync("which", ["zed"], { encoding: "utf8" });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  if (process.platform === "darwin" && existsSync(BUNDLED_ZED_CLI_MAC)) return BUNDLED_ZED_CLI_MAC;
  return null;
}
