import { createRoot } from "react-dom/client";
import BackyardViewer from "../app/BackyardViewer";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing viewer root");
}

createRoot(root).render(<BackyardViewer />);
