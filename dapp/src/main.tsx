import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import EscrowPage from "./pages/EscrowPage";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EscrowPage />
  </React.StrictMode>
);
