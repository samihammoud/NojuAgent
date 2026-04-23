import { useState } from "react";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import Header from "./components/Header";
import Chat from "./components/Chat";
import WorkspacePanel from "./components/WorkspacePanel";
import Dashboard from "./components/Dashboard";
import { useAgent, type ChatMessage } from "./lib/useAgent";
import { useMessages } from "./lib/useMessages";

function AuthScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <SignIn routing="hash" />
    </div>
  );
}

function Workspace({
  projectId,
  initialMessages,
  saveMessage,
}: {
  projectId: string;
  initialMessages: ChatMessage[];
  saveMessage: (role: "user" | "assistant", content: string) => void;
}) {
  const {
    messages,
    sendMessage,
    isConnected,
    openFiles,
    activeFile,
    setActiveFile,
    onLoadFile,
  } = useAgent(projectId, { initialMessages, onPersist: saveMessage });

  return (
    <div className="app">
      <Header />
      <div className="main">
        <Chat
          messages={messages}
          onSend={sendMessage}
          isConnected={isConnected}
        />
        <WorkspacePanel
          openFiles={openFiles}
          activeFile={activeFile}
          onSelectFile={setActiveFile}
          onLoadFile={onLoadFile}
        />
      </div>
    </div>
  );
}

function MainApp({ projectId }: { projectId: string }) {
  const { initialMessages, saveMessage, loaded } = useMessages(projectId);
  if (!loaded) return null;
  return <Workspace projectId={projectId} initialMessages={initialMessages} saveMessage={saveMessage} />;
}

function SignedInApp() {
  const [projectId, setProjectId] = useState<string | null>(null);

  if (!projectId) {
    return <Dashboard onSelectProject={setProjectId} />;
  }

  return <MainApp projectId={projectId} />;
}

export default function App() {
  return (
    <>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
      <SignedIn>
        <SignedInApp />
      </SignedIn>
    </>
  );
}
