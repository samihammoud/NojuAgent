import { useEffect, useRef } from "react";
import type { ChatMessage } from "../lib/useAgent";

interface Props {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  isConnected: boolean;
}

export default function Chat({ messages, onSend, isConnected }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = inputRef.current?.value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <aside className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            <div className="message-bubble">
              {msg.status === "thinking" ? (
                <span className="thinking-indicator">
                  <span className="thinking-dots">
                    <span /><span /><span />
                  </span>
                  {msg.toolInfo && (
                    <span className="thinking-label">{msg.toolInfo}</span>
                  )}
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={
            isConnected
              ? "Describe what to build or change..."
              : "Connecting to backend..."
          }
          disabled={!isConnected}
          onKeyDown={handleKeyDown}
          onChange={handleInput}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!isConnected}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
