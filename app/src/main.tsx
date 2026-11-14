import React from "react";
import ReactDOM from "react-dom/client";
// Archivo, with its width axis: the app's one typeface, bundled so Windows and macOS read alike (SIL OFL 1.1).
import "@fontsource-variable/archivo/wdth.css";
import App from "./App";
// Bob's theme: loaded after the app's own styles, which it overrides.
import "./bob-theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
