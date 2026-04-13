import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = path.join(os.homedir(), ".superset", "local.db");

export const supersetProvider = {
  name: "superset",
  aliases: [],
  description: "Superset (superset.sh)",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }
    if (process.platform !== "darwin") {
      throw new Error(`Superset provider only supports macOS right now (got ${process.platform}).`);
    }
    if (!existsSync(DB_PATH)) {
      throw new Error(
        `Superset database not found at ${DB_PATH}. Launch Superset at least once before using this command.`,
      );
    }

    const { projectId } = upsertProject(workspaceRoot);
    const url = `superset://project/${projectId}/`;
    const result = spawnSync("open", [url], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`\`open ${url}\` exited with ${result.status}.`);
    }
    console.log(`Opened ${workspaceRoot} in Superset.`);
  },
};

function upsertProject(workspaceRoot) {
  const db = new Database(DB_PATH);
  try {
    db.pragma("journal_mode = WAL");

    const existing = db
      .prepare("SELECT id FROM projects WHERE main_repo_path = ? LIMIT 1")
      .get(workspaceRoot);

    if (existing) {
      db.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?").run(
        Date.now(),
        existing.id,
      );
      return { projectId: existing.id, inserted: false };
    }

    const now = Date.now();
    const projectId = randomUUID();
    const name = path.basename(workspaceRoot) || workspaceRoot;

    db.prepare(
      `INSERT INTO projects (id, main_repo_path, name, color, last_opened_at, created_at)
       VALUES (?, ?, ?, 'default', ?, ?)`,
    ).run(projectId, workspaceRoot, name, now, now);

    return { projectId, inserted: true };
  } finally {
    db.close();
  }
}
