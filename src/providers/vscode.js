import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BUNDLE_ID = "com.microsoft.VSCode";

export const vscodeProvider = {
  name: "vscode",
  aliases: ["vsc"],
  description: "Visual Studio Code",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }

    if (process.platform !== "darwin") {
      throw new Error(`VSCode provider only supports macOS right now (got ${process.platform}).`);
    }

    const result = spawnSync("open", ["-b", BUNDLE_ID, workspaceRoot], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(
        `Could not open VSCode via bundle id ${BUNDLE_ID}. Is VSCode installed? (\`open -b\` exit ${result.status})`,
      );
    }
    console.log(`Opened ${workspaceRoot} in VSCode.`);
  },
};
