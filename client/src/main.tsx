import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { App } from "./components/App";

if (typeof window !== "undefined") {
  const savedTheme = window.localStorage.getItem("agent-board-theme") ?? "default";
  document.documentElement.dataset.theme = savedTheme;
  document.documentElement.style.colorScheme =
    savedTheme === "light" || savedTheme === "summer" ? "light" : "dark";
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
