import Header from "./components/Header";
import Chat from "./components/Chat";
import WorkspacePanel from "./components/WorkspacePanel";

export default function App() {
  return (
    <div className="app">
      <Header />
      <div className="main">
        <Chat />
        <WorkspacePanel />
      </div>
    </div>
  );
}
