import { useEffect, useRef, useState } from "react";
import type { WebContainer } from "@webcontainer/api";
import { useAuth } from "@clerk/clerk-react";
import { getWebContainer, loadProject } from "./webcontainer";
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

async function snapshotFs(wc: WebContainer): Promise<Record<string, string>> {
  const { files } = JSON.parse(await toolListFiles(wc, ".")) as { files: string[] };
  const snapshot: Record<string, string> = {};
  await Promise.all(
    files.map(async (p) => {
      snapshot[p] = await wc.fs.readFile(p, "utf-8");
    }),
  );
  return snapshot;
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

  // Fetch project files, mount + install + start Vite. Empty projects get
  // the default template (which includes vite in devDependencies).
  useEffect(() => {
    if (!projectId) return;
    setWcReady(false);
    (async () => {
      try {
        const res = await fetch(`/api/files?project_id=${projectId}`);
        const fetched: Record<string, string> = res.ok ? (await res.json()) ?? {} : {};
        const files = Object.keys(fetched).length === 0 ? defaultEditorFiles : fetched;

        await loadProject(files);

        setOpenFiles(files);
        setWcReady(true);
      } catch (err) {
        console.error("[files] failed to load project:", err);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    // Wait for WebContainer to be populated before opening the WS — otherwise
    // a long initial pnpm install leaves an idle WS open for 30-60s, which
    // dev proxies (Vite, etc.) can drop.
    if (!wcReady) return;

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

        // If agent wrote a file, update the editor cache for immediate feedback
        if (msg.tool === "write_file") {
          const args = msg.arguments as Record<string, string>;
          setOpenFiles((prev) => ({ ...prev, [args.path]: args.content }));
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

        // Snapshot live WebContainer FS — single source of truth for both
        // editor UI and Supabase persistence. Captures pnpm add side-effects
        // on package.json and any files created by shell commands.
        try {
          const wc = await getWebContainer();
          const snapshot = await snapshotFs(wc);
          setOpenFiles(snapshot);
          fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: projectId, files: snapshot }),
          }).catch((err) =>
            console.error("[files] failed to save files:", err),
          );
        } catch (err) {
          console.error("[files] snapshot failed:", err);
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
  }, [userId, projectId, wcReady]);

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
