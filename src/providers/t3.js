import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const APP_NAME_MAC = "T3 Code (Alpha)";
const DEFAULT_MODEL_SELECTION = { provider: "codex", model: "gpt-5.4" };
const DEFAULT_RUNTIME_MODE = "full-access";

export const t3Provider = {
  name: "t3",
  aliases: ["t3chat", "t3code"],
  description: "T3 Code (https://github.com/pingdotgg/t3code)",

  async open(workspaceRoot) {
    if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Not a directory: ${workspaceRoot}`);
    }

    const runtime = readServerRuntime();
    const cookie = readSessionCookie();

    if (runtime && cookie) {
      try {
        await openViaHttp(runtime, cookie, workspaceRoot);
        launchDesktopApp();
        console.log(`Opened ${workspaceRoot} in T3 Code.`);
        return;
      } catch (err) {
        console.warn(`T3 Code HTTP API failed (${err.message}). Falling back to direct DB insert.`);
      }
    }

    upsertProjectViaSqlite(workspaceRoot);
    launchDesktopApp();
    console.log(`Opened ${workspaceRoot} in T3 Code.`);
  },
};

function readServerRuntime() {
  const home = process.env.T3CODE_HOME || path.join(os.homedir(), ".t3");
  const file = path.join(home, "userdata", "server-runtime.json");
  if (!existsSync(file)) return null;
  try {
    const runtime = JSON.parse(readFileSync(file, "utf8"));
    if (!runtime?.port || !runtime?.host) return null;
    return runtime;
  } catch {
    return null;
  }
}

function readSessionCookie() {
  const candidates = [
    path.join(os.homedir(), "Library/Application Support/t3code/Cookies"),
    path.join(os.homedir(), ".config/t3code/Cookies"),
  ];
  for (const dbPath of candidates) {
    if (!existsSync(dbPath)) continue;
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      try {
        const row = db
          .prepare("SELECT value FROM cookies WHERE name = 't3_session' LIMIT 1")
          .get();
        if (row?.value) return row.value;
      } finally {
        db.close();
      }
    } catch {
      // cookie store may be locked; fall through
    }
  }
  return null;
}

async function openViaHttp(runtime, cookie, workspaceRoot) {
  const origin = runtime.origin || `http://${runtime.host}:${runtime.port}`;
  const headers = {
    "Content-Type": "application/json",
    Cookie: `t3_session=${cookie}`,
    Accept: "application/json",
  };

  const snapshot = await fetchJson(`${origin}/api/orchestration/snapshot`, { headers });
  const existing = snapshot.projects?.find(
    (p) => p.workspaceRoot === workspaceRoot && !p.deletedAt,
  );

  const projectId = existing?.id ?? randomUUID();
  const projectCreated = !existing;

  if (projectCreated) {
    await dispatchCommand(origin, headers, {
      type: "project.create",
      commandId: randomUUID(),
      projectId,
      title: path.basename(workspaceRoot) || workspaceRoot,
      workspaceRoot,
      defaultModelSelection: DEFAULT_MODEL_SELECTION,
      createdAt: new Date().toISOString(),
    });
  }

  const threadId = randomUUID();
  await dispatchCommand(origin, headers, {
    type: "thread.create",
    commandId: randomUUID(),
    threadId,
    projectId,
    title: "New chat",
    modelSelection: existing?.defaultModelSelection ?? DEFAULT_MODEL_SELECTION,
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt: new Date().toISOString(),
  });

  return { projectId, threadId, projectCreated };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${url} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function dispatchCommand(origin, headers, command) {
  return fetchJson(`${origin}/api/orchestration/dispatch`, {
    method: "POST",
    headers,
    body: JSON.stringify(command),
  });
}

function upsertProjectViaSqlite(workspaceRoot) {
  const dbPath = path.join(
    process.env.T3CODE_HOME || path.join(os.homedir(), ".t3"),
    "userdata",
    "state.sqlite",
  );
  if (!existsSync(dbPath)) {
    throw new Error(
      `T3 Code state not found at ${dbPath}. Launch T3 Code at least once before using this command.`,
    );
  }

  const db = new Database(dbPath);
  try {
    db.pragma("journal_mode = WAL");

    const existing = db
      .prepare(
        `SELECT project_id FROM projection_projects
         WHERE workspace_root = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(workspaceRoot);

    if (existing) {
      return { inserted: false, projectId: existing.project_id };
    }

    const projectId = randomUUID();
    const nowIso = new Date().toISOString();
    const title = path.basename(workspaceRoot) || workspaceRoot;

    const payload = {
      projectId,
      title,
      workspaceRoot,
      scripts: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      defaultModelSelection: null,
    };

    const insertEvent = db.prepare(
      `INSERT INTO orchestration_events (
         event_id, aggregate_kind, stream_id, stream_version,
         event_type, occurred_at, command_id, causation_event_id,
         correlation_id, actor_kind, payload_json, metadata_json
       ) VALUES (?, 'project', ?, 1, 'project.created', ?, NULL, NULL, NULL, 'client', ?, '{}')`,
    );

    const insertProjection = db.prepare(
      `INSERT INTO projection_projects (
         project_id, title, workspace_root,
         default_model_selection_json, scripts_json,
         created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, NULL, '[]', ?, ?, NULL)`,
    );

    db.transaction(() => {
      insertEvent.run(randomUUID(), projectId, nowIso, JSON.stringify(payload));
      insertProjection.run(projectId, title, workspaceRoot, nowIso, nowIso);
    })();

    return { inserted: true, projectId };
  } finally {
    db.close();
  }
}

function launchDesktopApp() {
  if (process.platform === "darwin") {
    spawn("open", ["-a", APP_NAME_MAC], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  console.log(
    `(Auto-launch not implemented for ${process.platform}. Start T3 Code manually.)`,
  );
}
