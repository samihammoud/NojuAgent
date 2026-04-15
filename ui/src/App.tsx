import Header from "./components/Header";
import Chat from "./components/Chat";
import WorkspacePanel from "./components/WorkspacePanel";
import { useAgent } from "./lib/useAgent";

export default function App() {
  const { messages, sendMessage, isConnected, openFiles, activeFile, setActiveFile, onLoadFile } =
    useAgent();

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
