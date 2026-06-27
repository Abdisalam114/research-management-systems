import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/design-tokens.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProgramTierProvider } from "./context/ProgramTierContext.jsx";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProgramTierProvider>
          <App />
        </ProgramTierProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
