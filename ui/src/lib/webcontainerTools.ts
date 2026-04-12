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
