import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ChainProvider } from "./state/ChainContext.jsx";

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 32, maxWidth: 560, margin: "10vh auto", font: "15px system-ui" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#888" }}>{String(this.state.err.message || this.state.err)}</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Boundary>
      <ChainProvider>
        <App />
      </ChainProvider>
    </Boundary>
  </StrictMode>,
);
