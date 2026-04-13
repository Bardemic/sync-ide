#!/usr/bin/env node
import path from "node:path";
import { providers, resolveProvider } from "./providers/index.js";

const HELP = `ide — open the current repo in any coding IDE or agent GUI

Usage:
  ide <provider> [path]    Open path (default: cwd) in the provider's GUI
  ide list                 List supported providers
  ide --help               Show this help
  ide --version            Print the CLI version

Providers:
${providers.map((p) => `  ${p.name.padEnd(10)} ${p.description}`).join("\n")}
`;

run(process.argv.slice(2)).catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

export async function run(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    const { version } = await readPkg();
    process.stdout.write(`${version}\n`);
    return;
  }

  if (cmd === "list") {
    for (const p of providers) {
      const aliases = p.aliases?.length ? ` (aliases: ${p.aliases.join(", ")})` : "";
      process.stdout.write(`${p.name}${aliases} — ${p.description}\n`);
    }
    return;
  }

  const provider = resolveProvider(cmd);
  if (!provider) {
    process.stderr.write(`Unknown provider: ${cmd}\n\n${HELP}`);
    process.exit(1);
  }

  const target = path.resolve(rest[0] ?? process.cwd());
  await provider.open(target);
}

async function readPkg() {
  const url = new URL("../package.json", import.meta.url);
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(url, "utf8"));
}
