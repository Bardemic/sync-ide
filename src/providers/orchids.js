import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const APP_NAME_MAC = "Orchids";
const RECENT_PROJECTS_FILE = path.join(
  os.homedir(),
  "Library/Application Support/Orchids/orchids-recent-projects.json",
);

export const orchidsProvider = {
  name: "orchids",
  aliases: [],
  description: "Orchids desktop app",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }

    if (process.platform !== "darwin") {
      throw new Error(`Orchids provider only supports macOS right now (got ${process.platform}).`);
    }

    upsertRecentProject(workspaceRoot);
    spawn("open", ["-a", APP_NAME_MAC], { detached: true, stdio: "ignore" }).unref();
    console.log(`Opened ${workspaceRoot} in Orchids.`);
  },
};

function upsertRecentProject(workspaceRoot) {
  const state = readState();
  const existingIdx = state.recentProjects.findIndex((p) => p.folderPath === workspaceRoot);
  const now = Date.now();

  if (existingIdx >= 0) {
    const [entry] = state.recentProjects.splice(existingIdx, 1);
    entry.lastOpened = now;
    state.recentProjects.unshift(entry);
    writeState(state);
    return { inserted: false, projectId: entry.projectId };
  }

  const projectId = randomUUID();
  state.recentProjects.unshift({
    folderPath: workspaceRoot,
    projectId,
    projectName: path.basename(workspaceRoot) || workspaceRoot,
    lastOpened: now,
  });
  writeState(state);
  return { inserted: true, projectId };
}

function readState() {
  if (!existsSync(RECENT_PROJECTS_FILE)) {
    return { recentProjects: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(RECENT_PROJECTS_FILE, "utf8"));
    if (!Array.isArray(parsed?.recentProjects)) return { recentProjects: [] };
    return parsed;
  } catch {
    return { recentProjects: [] };
  }
}

function writeState(state) {
  writeFileSync(RECENT_PROJECTS_FILE, `${JSON.stringify(state, null, 2)}\n`);
}
