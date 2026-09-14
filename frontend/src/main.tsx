import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import QueryClientProviderComponent from "./providers/QueryClientProvider";
import GlobalDialogProvider from "./components/GlobalDialogProvider";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProviderComponent>
        <GlobalDialogProvider>
          <App />
        </GlobalDialogProvider>
      </QueryClientProviderComponent>
    </BrowserRouter>
  </React.StrictMode>,
);
