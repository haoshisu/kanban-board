import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import initSentry from "./lib/sentry.ts";
import App from "./App.tsx";
import ErrorFallback from "./shared/components/ErrorFallback.tsx";

initSentry();

createRoot(document.getElementById("root")!).render(
 <StrictMode>
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
   <App />
  </Sentry.ErrorBoundary>
 </StrictMode>,
);
