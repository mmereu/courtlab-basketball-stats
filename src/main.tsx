import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import TesterLanding from "./components/TesterLanding";
import "./styles.css";

const isTesterPage = window.location.hash === "#/diventa-tester";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isTesterPage ? <TesterLanding /> : <App />}
  </StrictMode>,
);
