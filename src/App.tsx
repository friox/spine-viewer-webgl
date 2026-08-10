import "./App.css";
import { SpineViewer } from "./components/SpineViewer";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SpineViewer />
    </ThemeProvider>
  );
}

export default App;
