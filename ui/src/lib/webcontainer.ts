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

// Boot phase for Preview UX
export type BootPhase = "booting" | "installing" | "starting" | "ready" | "error";
let currentBootPhase: BootPhase = "booting";
const bootPhaseListeners = new Set<(phase: BootPhase) => void>();

export function onBootPhaseChange(cb: (phase: BootPhase) => void): () => void {
  bootPhaseListeners.add(cb);
  cb(currentBootPhase); // Emit current phase immediately to new subscriber
  return () => bootPhaseListeners.delete(cb);
}

function setBootPhase(phase: BootPhase) {
  currentBootPhase = phase;
  bootPhaseListeners.forEach((cb) => cb(phase));
}

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (ready) return ready;

  ready = (async () => {
    setBootPhase("booting");
    const wc = await WebContainer.boot();
    await wc.mount(previewFiles);

    // Warmup the WASM filesystem workers
    await wc.fs.writeFile(".__warmup", "ok");
    await wc.fs.readFile(".__warmup", "utf-8");
    await wc.fs.rm(".__warmup");

    // Resolve the singleton immediately so chat input is not blocked by install
    instance = wc;

    // Install dependencies with pnpm (pre-installed in WebContainer, faster than npm)
    setBootPhase("installing");
    const installProcess = await wc.spawn("pnpm", ["install"]);
    const installExit = await Promise.race([
      installProcess.exit,
      new Promise<number>((resolve) => setTimeout(() => resolve(-1), 180_000)),
    ]);

    if (installExit !== 0) {
      setBootPhase("error");
      throw new Error(`pnpm install failed with exit code ${installExit}`);
    }

    // Start Vite dev server
    setBootPhase("starting");
    wc.spawn("pnpm", ["run", "dev"]);

    wc.on("server-ready", (_port, url) => {
      serverUrlResolve(url);
      setBootPhase("ready");
    });

    return wc;
  })();

  return ready;
}

// Boot immediately on module load so tools are never waiting for Preview to mount
getWebContainer();
