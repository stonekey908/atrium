import React from "react";
import ReactDOM from "react-dom/client";

// T-003: bundle the three project fonts locally as variable woff2.
// These import only the latin + latin-ext subsets and trim the cyrillic /
// greek / vietnamese subsets the packages also ship — keeps the bundle
// lean. Vite emits the woff2 files into dist/assets/, so the production
// build makes zero requests to fonts.googleapis.com.
//
// Family names declared by these files are the "Variable" variants
// ("Source Serif 4 Variable", "Inter Tight Variable", "JetBrains Mono
// Variable"). The Tailwind font stacks in tailwind.config.ts list those
// first, then fall back to the bare names + system stacks.
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";

import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
