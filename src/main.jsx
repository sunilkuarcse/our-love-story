
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.jsx";
import { AuthProvider, ProtectedRoute } from "./auth.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  </React.StrictMode>
);
