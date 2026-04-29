import { WebContainer } from "@webcontainer/api";
import type { WebContainerProcess } from "@webcontainer/api";
import { buildFileSystemTree } from "./previewFiles";

// Boot phase for Preview UX
export type BootPhase = "idle" | "installing" | "starting" | "ready" | "error";
let currentBootPhase: BootPhase = "idle";
const bootPhaseListeners = new Set<(phase: BootPhase) => void>();

export function onBootPhaseChange(cb: (phase: BootPhase) => void): () => void {
  bootPhaseListeners.add(cb);
  cb(currentBootPhase);
  return () => bootPhaseListeners.delete(cb);
}

function setBootPhase(phase: BootPhase) {
  currentBootPhase = phase;
  bootPhaseListeners.forEach((cb) => cb(phase));
}

// Server URL subscription — replaces the old one-shot promise. URL changes
// per project switch, so listeners need to react to each new URL.
let currentServerUrl: string | null = null;
const serverUrlListeners = new Set<(url: string | null) => void>();

export function onServerUrlChange(cb: (url: string | null) => void): () => void {
  serverUrlListeners.add(cb);
  cb(currentServerUrl);
  return () => serverUrlListeners.delete(cb);
}

function setServerUrl(url: string | null) {
  currentServerUrl = url;
  serverUrlListeners.forEach((cb) => cb(url));
}

let instance: WebContainer | null = null;
let ready: Promise<WebContainer> | null = null;

// Boot the runtime only — no install, no Vite. Project load handles those.
export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (ready) return ready;

  ready = (async () => {
    const wc = await WebContainer.boot();
    // Warmup the WASM filesystem workers
    await wc.fs.writeFile(".__warmup", "ok");
    await wc.fs.readFile(".__warmup", "utf-8");
    await wc.fs.rm(".__warmup");
    instance = wc;
    return wc;
  })();

  return ready;
}

// Tracks the running Vite process so we can kill it on project switch.
let currentDevProcess: WebContainerProcess | null = null;

// Single entry point for "make this project run". Tears down any previous
// project's Vite, mounts files atomically, installs deps, starts Vite, waits
// for server-ready, returns URL.
export async function loadProject(files: Record<string, string>): Promise<string> {
  const wc = await getWebContainer();

  // Kill the previous Vite if switching projects
  if (currentDevProcess) {
    currentDevProcess.kill();
    currentDevProcess = null;
    setServerUrl(null);
  }

  setBootPhase("installing");
  await wc.mount(buildFileSystemTree(files));

  const installProcess = await wc.spawn("pnpm", ["install"]);
  installProcess.output.pipeTo(new WritableStream({ write() {} }));
  const installExit = await Promise.race([
    installProcess.exit,
    new Promise<number>((resolve) => setTimeout(() => resolve(-1), 180_000)),
  ]);
  if (installExit !== 0) {
    setBootPhase("error");
    throw new Error(`pnpm install failed with exit code ${installExit}`);
  }

  setBootPhase("starting");

  // Listener registered before spawn — race-free
  const urlPromise = new Promise<string>((resolve) => {
    wc.on("server-ready", (_port, url) => {
      setServerUrl(url);
      resolve(url);
    });
  });

  const devProcess = await wc.spawn("pnpm", ["run", "dev"]);
  currentDevProcess = devProcess;

  const devOutput: string[] = [];
  devProcess.output.pipeTo(
    new WritableStream({
      write(chunk) {
        if (devOutput.length < 200) devOutput.push(chunk);
      },
    }),
  );

  // If the dev process exits before server-ready, surface the error
  devProcess.exit.then(() => {
    if (currentBootPhase !== "ready") {
      console.error("[webcontainer] Vite exited before server-ready:\n", devOutput.join(""));
      setBootPhase("error");
    }
  });

  const url = await urlPromise;
  setBootPhase("ready");
  return url;
}

// Boot the runtime eagerly so it's ready by the time a project is selected
getWebContainer();
