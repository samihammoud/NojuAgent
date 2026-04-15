import { WebContainer } from "@webcontainer/api";
import { previewFiles } from "./previewFiles";

let instance: WebContainer | null = null;
let ready: Promise<WebContainer> | null = null;

// Resolved once server-ready fires — Preview reads this instead of registering
// its own listener (which would miss the event if it mounts after server starts).
let serverUrlResolve!: (url: string) => void;
export const serverUrlPromise = new Promise<string>((resolve) => {
  serverUrlResolve = resolve;
});

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (ready) return ready;

  ready = (async () => {
    const wc = await WebContainer.boot();
    await wc.mount(previewFiles);

    // Warm up the WASM filesystem workers by doing a dummy read/write cycle.
    // Without this, the first large write_file can stall
    // the unwarmed workers and hit the backend's 30s tool timeout.
    await wc.fs.writeFile(".__warmup", "ok");
    await wc.fs.readFile(".__warmup", "utf-8");
    await wc.fs.rm(".__warmup");

    wc.on("server-ready", (_port, url) => {
      serverUrlResolve(url);
    });

    wc.spawn("node", ["server.js"]);
    instance = wc;
    return wc;
  })();

  return ready;
}

// Boot immediately on module load so tools are never waiting for Preview to mount
getWebContainer();
