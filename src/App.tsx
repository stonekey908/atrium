import { AppShell } from "./components/AppShell";
import { TitleBar } from "./components/TitleBar";

function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar />
      <AppShell />
    </div>
  );
}

export default App;
