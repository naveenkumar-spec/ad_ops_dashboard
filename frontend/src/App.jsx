import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Overview from "./pages/Overview";
import ManagementView from "./pages/ManagementView";
import Login from "./pages/Login";
import AdminSetup from "./pages/AdminSetup";
import { clearSession, loadSession, saveSession } from "./auth/session";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
axios.defaults.baseURL = API_BASE_URL;

const initialSession = loadSession();
if (initialSession?.token) {
  axios.defaults.headers.common.Authorization = `Bearer ${initialSession.token}`;
}

function RouteGuard({ session, tab, children }) {
  if (!session?.token) return <Navigate to="/login" replace />;
  const allowed = session.user?.allowedTabs || ["overview", "management"];
  if (session.user?.role !== "admin" && tab && !allowed.includes(tab)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  const [session, setSession] = useState(() => initialSession);

  useEffect(() => {
    const token = session?.token;
    axios.defaults.baseURL = API_BASE_URL;
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [session?.token]);

  const handleLogin = (result) => {
    if (result?.token) {
      axios.defaults.headers.common.Authorization = `Bearer ${result.token}`;
    }
    saveSession(result);
    setSession(result);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const currentUser = useMemo(() => session?.user || null, [session]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session?.token ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/"
          element={(
            <RouteGuard session={session} tab="overview">
              <Overview currentUser={currentUser} onLogout={handleLogout} />
            </RouteGuard>
          )}
        />
        <Route
          path="/management"
          element={(
            <RouteGuard session={session} tab="management">
              <ManagementView currentUser={currentUser} onLogout={handleLogout} />
            </RouteGuard>
          )}
        />
        <Route
          path="/admin"
          element={(
            <RouteGuard session={session} tab="admin">
              <AdminSetup currentUser={currentUser} onLogout={handleLogout} />
            </RouteGuard>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

