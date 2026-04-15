import { useEffect, useRef, useState } from "react";
import { getWebContainer } from "./webcontainer";
import { previewFiles } from "./previewFiles";
import {
  toolListFiles,
  toolReadFile,
  toolWriteFile,
} from "./webcontainerTools";

const defaultIndexHtml = (previewFiles["index.html"] as { file: { contents: string } }).file.contents;

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
    default:
      return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isConnected, setIsConnected] = useState(false);
  const [wcReady, setWcReady] = useState(false);
  const [indexHtml, setIndexHtml] = useState<string | null>(defaultIndexHtml);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Track WebContainer readiness separately from WebSocket connection
  useEffect(() => {
    getWebContainer().then(() => setWcReady(true));
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    //Vite Proxy connects to FastAPI's WebSocket endpoint at /api/ws
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

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
        ws.send(
          JSON.stringify({
            type: "tool_result",
            tool_use_id: msg.tool_use_id,
            result,
          }),
        );
      } else if (msg.type === "assistant_message") {
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

        // Read updated index.html and signal preview reload
        try {
          const wc = await getWebContainer();
          const content = await wc.fs.readFile("index.html", "utf-8");
          console.log("[preview] index.html updated, length:", content.length);
          setIndexHtml(content);
          setPreviewRefreshKey((k) => k + 1);
        } catch (err) {
          console.error(
            "[preview] failed to read index.html after agent turn:",
            err,
          );
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
      // StrictMode calls cleanup while the socket may still be CONNECTING.
      // Closing mid-handshake triggers a browser warning, so defer the close
      // until the connection opens, then shut it immediately.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
      wsRef.current = null;
    };
  }, []);

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
  }

  return {
    messages,
    sendMessage,
    isConnected: isConnected && wcReady,
    indexHtml,
    previewRefreshKey,
  };
}
