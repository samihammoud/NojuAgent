import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import Header from "./components/Header";
import Chat from "./components/Chat";
import WorkspacePanel from "./components/WorkspacePanel";
import { useAgent } from "./lib/useAgent";

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

function MainApp() {
  const {
    messages,
    sendMessage,
    isConnected,
    openFiles,
    activeFile,
    setActiveFile,
    onLoadFile,
  } = useAgent();

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

export default function App() {
  return (
    <>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
      <SignedIn>
        <MainApp />
      </SignedIn>
    </>
  );
}
