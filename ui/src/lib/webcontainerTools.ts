import type { WebContainer } from "@webcontainer/api";

async function collectFiles(wc: WebContainer, dir: string): Promise<string[]> {
  const entries = await wc.fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const fullPath = dir === "." ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(wc, fullPath)));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

export async function toolListFiles(
  wc: WebContainer,
  dir: string
): Promise<string> {
  try {
    const files = await collectFiles(wc, dir || ".");
    return JSON.stringify({ files });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function toolReadFile(
  wc: WebContainer,
  path: string
): Promise<string> {
  try {
    const content = await wc.fs.readFile(path, "utf-8");
    return JSON.stringify({ content });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function toolWriteFile(
  wc: WebContainer,
  path: string,
  content: string
): Promise<string> {
  try {
    // Ensure parent directories exist
    const parts = path.split("/");
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join("/");
      await wc.fs.mkdir(dir, { recursive: true });
    }
    await wc.fs.writeFile(path, content);
    return JSON.stringify({ success: true, path });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

const ALLOWED_COMMANDS = ["install", "i", "add", "run", "exec", "create", "build"];

export async function toolRunCommand(
  wc: WebContainer,
  command: string,
  timeoutMs: number = 90_000
): Promise<string> {
  const parts = command.trim().split(/\s+/);
  const bin = parts[0];
  const sub = parts[1];

  if (bin !== "npm" && bin !== "npx" && bin !== "pnpm") {
    return JSON.stringify({ error: "Command not allowed. Only npm, npx, and pnpm are permitted." });
  }
  if (!sub || !ALLOWED_COMMANDS.includes(sub)) {
    return JSON.stringify({ error: `Subcommand '${sub}' not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}` });
  }

  try {
    const process = await wc.spawn(bin, parts.slice(1));

    const chunks: string[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 32 * 1024;

    const reader = process.output.getReader();
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (totalBytes < MAX_BYTES) {
          chunks.push(value);
          totalBytes += value.length;
        }
      }
    })();

    const exitCode = await Promise.race([
      process.exit,
      new Promise<number>((resolve) =>
        setTimeout(() => {
          process.kill();
          resolve(-1);
        }, timeoutMs)
      ),
    ]);

    await readLoop.catch(() => {});
    const output = chunks.join("");

    if (exitCode === -1) {
      return JSON.stringify({ error: `Command timed out after ${timeoutMs / 1000}s`, output });
    }

    return JSON.stringify({ exitCode, output });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
