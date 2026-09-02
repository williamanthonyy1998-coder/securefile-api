import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import QueryClientProviderComponent from "./providers/QueryClientProvider";

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <QueryClientProviderComponent>
                <App />
            </QueryClientProviderComponent>
        </BrowserRouter>
    </React.StrictMode>,
);
