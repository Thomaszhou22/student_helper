import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { HubUiLangProvider } from "./context/HubUiLangContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HubUiLangProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </HubUiLangProvider>
  </StrictMode>
);
