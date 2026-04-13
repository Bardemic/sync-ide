import { t3Provider } from "./t3.js";
import { ghdProvider } from "./ghd.js";
import { codexProvider } from "./codex.js";
import { zedProvider } from "./zed.js";
import { cursorProvider, cursorGlassProvider } from "./cursor.js";
import { orchidsProvider } from "./orchids.js";
import { vscodeProvider } from "./vscode.js";

export const providers = [
  t3Provider,
  ghdProvider,
  codexProvider,
  zedProvider,
  cursorProvider,
  cursorGlassProvider,
  orchidsProvider,
  vscodeProvider,
];

export function resolveProvider(name) {
  const key = name.toLowerCase();
  return providers.find((p) => p.name === key || p.aliases?.includes(key));
}
