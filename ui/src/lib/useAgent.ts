import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getWebContainer } from "./webcontainer";
import { defaultEditorFiles } from "./previewFiles";
import {
  toolListFiles,
  toolReadFile,
  toolWriteFile,
  toolRunCommand,
} from "./webcontainerTools";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** "thinking" = agent is running, "done" = final content */
  status: "thinking" | "done";
  /** Short status line shown while the agent is using a tool */
  toolInfo?: string;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Noju. Describe what you'd like to build and I'll generate it for you.",
  status: "done",
};

function toolLabel(tool: string, args: Record<string, string>): string {
  switch (tool) {
    case "list_files":
      return `Listing files in ${args.dir ?? "."}`;
    case "read_file":
      return `Reading ${args.path}`;
    case "write_file":
      return `Writing ${args.path}`;
    case "run_command":
      return `Running: ${args.command}`;
    default:
      return `Running ${tool}`;
  }
}

async function executeTool(
  tool: string,
  args: Record<string, string>,
): Promise<string> {
  const wc = await getWebContainer();
  switch (tool) {
    case "list_files":
      return toolListFiles(wc, args.dir ?? ".");
    case "read_file":
      return toolReadFile(wc, args.path);
    case "write_file":
      return toolWriteFile(wc, args.path, args.content);
    case "run_command":
      return toolRunCommand(wc, args.command, 120_000);
    default:
      return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

const DEFAULT_PACKAGES = new Set(["react", "react-dom", "vite"]);

function extraPackages(packageJson: string): string[] {
  try {
    const pkg = JSON.parse(packageJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(all).filter((p) => !DEFAULT_PACKAGES.has(p));
  } catch {
    return [];
  }
}

interface AgentOptions {
  initialMessages?: ChatMessage[];
  // onPersist is the callback for posting user and assistant messages to the DB
  onPersist?: (role: "user" | "assistant", content: string) => void;
}

//Requires projectID to pass to the WebSocket, so backend knows what files to load/send to the webContainer.
//WebContainer is just a FS, only responsible for showing what it is given on mount
export function useAgent(
  projectId: string,
  { initialMessages = [WELCOME], onPersist }: AgentOptions = {},
) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);
  const [wcReady, setWcReady] = useState(false);
  const [openFiles, setOpenFiles] =
    useState<Record<string, string>>(defaultEditorFiles);
  const [activeFile, setActiveFile] = useState<string>("src/App.jsx");
  const wsRef = useRef<WebSocket | null>(null);
  // Always mirrors openFiles state so the wsRef.current.onmessage closure can read current files
  const openFilesRef = useRef<Record<string, string>>(defaultEditorFiles);

  // Fetch project files, wait for WebContainer, then write them in
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/files?project_id=${projectId}`);
        const files: Record<string, string> = res.ok ? (await res.json()) ?? {} : {};
        const wc = await getWebContainer();

        // Install extra packages first so Vite never sees a broken import state
        const savedPkg = files["package.json"];
        if (savedPkg) {
          const extras = extraPackages(savedPkg);
          if (extras.length > 0) {
            await toolRunCommand(wc, `pnpm add ${extras.join(" ")}`, 180_000);
          }
        }

        // Write source files after packages are ready (skip manifests)
        const writable = Object.entries(files).filter(
          ([p]) => p !== "package.json" && p !== "pnpm-lock.yaml"
        );
        for (const [path, content] of writable) {
          await toolWriteFile(wc, path, content);
        }
        if (writable.length > 0) {
          const next = { ...defaultEditorFiles, ...Object.fromEntries(writable) };
          openFilesRef.current = next;
          setOpenFiles(next);
        }

        setWcReady(true);
      } catch (err) {
        console.error("[files] failed to load persisted files:", err);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const uid = userId ?? "anonymous";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/ws?user_id=${uid}&project_id=${projectId}`,
    );
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    //callback: fires when backend sends a message
    ws.onmessage = async (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as Record<string, unknown>;

      if (msg.type === "tool_call") {
        const label = toolLabel(
          msg.tool as string,
          msg.arguments as Record<string, string>,
        );
        console.log("[tool_call]", msg.tool, msg.arguments);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.status === "thinking") {
            return [...prev.slice(0, -1), { ...last, toolInfo: label }];
          }
          return prev;
        });

        const result = await executeTool(
          msg.tool as string,
          msg.arguments as Record<string, string>,
        );
        console.log("[tool_result]", msg.tool, result.slice(0, 200));

        // If agent wrote a file, update the editor cache
        if (msg.tool === "write_file") {
          const args = msg.arguments as Record<string, string>;
          setOpenFiles((prev) => {
            const next = { ...prev, [args.path]: args.content };
            openFilesRef.current = next;
            return next;
          });
          setActiveFile(args.path);
        }

        ws.send(
          JSON.stringify({
            type: "tool_result",
            tool_use_id: msg.tool_use_id,
            result,
          }),
        );
      } else if (msg.type === "turn_complete") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.status === "thinking") {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: msg.content as string,
                status: "done" as const,
                toolInfo: undefined,
              },
            ];
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant" as const,
              content: msg.content as string,
              status: "done" as const,
            },
          ];
        });

        //save assistant message to DB
        onPersist?.("assistant", msg.content as string);

        // Flush all current files to DB, including live package.json from WebContainer
        // (pnpm add updates it in-container but never goes through write_file)
        const snapshot = { ...openFilesRef.current };
        try {
          const wc = await getWebContainer();
          snapshot["package.json"] = await wc.fs.readFile("package.json", "utf-8");
        } catch {}
        if (Object.keys(snapshot).length > 0) {
          fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: projectId, files: snapshot }),
          }).catch((err) =>
            console.error("[files] failed to save files:", err),
          );
        }

        // Refresh file tree after agent turn
        try {
          const wc = await getWebContainer();
          const result = await toolListFiles(wc, ".");
          const { files } = JSON.parse(result) as { files: string[] };
          // Load content for any new files not yet in cache
          const updates: Record<string, string> = {};
          await Promise.all(
            files.map(async (f) => {
              if (!(f in openFiles)) {
                try {
                  const content = await wc.fs.readFile(f, "utf-8");
                  updates[f] = content;
                } catch {}
              }
            }),
          );
          if (Object.keys(updates).length > 0) {
            setOpenFiles((prev) => ({ ...prev, ...updates }));
          }
        } catch (err) {
          console.error("[files] failed to refresh file tree:", err);
        }
      } else if (msg.type === "error") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.status === "thinking") {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: `Error: ${msg.message as string}`,
                status: "done" as const,
                toolInfo: undefined,
              },
            ];
          }
          return prev;
        });
      }
    };

    return () => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [userId, projectId]);

  async function onLoadFile(path: string): Promise<string> {
    if (openFiles[path] !== undefined) return openFiles[path];
    try {
      const wc = await getWebContainer();
      const content = await wc.fs.readFile(path, "utf-8");
      setOpenFiles((prev) => ({ ...prev, [path]: content }));
      return content;
    } catch {
      return "";
    }
  }

  //closure for chat component
  function sendMessage(content: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      status: "done",
    };
    const thinkingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      status: "thinking",
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    onPersist?.("user", content);
  }

  return {
    messages,
    sendMessage,
    isConnected: isConnected && wcReady,
    openFiles,
    activeFile,
    setActiveFile,
    onLoadFile,
  };
}
