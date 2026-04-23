import { useEffect, useState } from "react";
import type { ChatMessage } from "./useAgent";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm Noju. Describe what you'd like to build and I'll generate it for you.",
  status: "done",
};

export function useMessages(projectId: string) {
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([WELCOME]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/messages`);
        if (!res.ok) return;
        const rows = (await res.json()) as { role: string; content: string }[];
        if (rows.length > 0) {
          setInitialMessages(
            rows.map((row, i) => ({
              id: `history-${i}`,
              role: row.role as "user" | "assistant",
              content: String(row.content),
              status: "done" as const,
            })),
          );
        }
      } catch (err) {
        console.error("[messages] failed to load history:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, [projectId]);

  // onPersist callback — POSTs a single message to the DB
  function saveMessage(role: "user" | "assistant", content: string): void {
    fetch(`/api/projects/${projectId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    }).catch((err) => console.error("[messages] failed to save:", err));
  }

  return { initialMessages, saveMessage, loaded };
}
