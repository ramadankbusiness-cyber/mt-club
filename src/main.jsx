import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
    <App />
  </BrowserRouter>
);