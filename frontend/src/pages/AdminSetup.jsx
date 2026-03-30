import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import DashboardHeader from "../components/DashboardHeader";
import AppLayout from "../components/AppLayout";
import "../../styles/AdminSetup.css";

function MultiSelectDropdown({ label, options = [], value = [], onChange, disabled = false, placeholder = "Select options" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const normalized = new Set(value.map((v) => String(v)));
  const summary = value.length === 0 ? placeholder : value.length <= 3 ? value.join(", ") : `${value.length} selected`;

  const toggleValue = (option) => {
    const text = String(option);
    if (normalized.has(text)) {
      onChange(value.filter((v) => String(v) !== text));
    } else {
      onChange([...value, text]);
    }
  };

  return (
    <div className="ms-wrap" ref={ref}>
      <label>{label}</label>
      <button
        type="button"
        className={`ms-trigger ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span>{summary}</span>
        <span className="ms-arrow">{open ? "â–²" : "â–¼"}</span>
      </button>
      {open && !disabled ? (
        <div className="ms-panel">
          <div className="ms-actions">
            <button type="button" onClick={() => onChange(options)}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="ms-options">
            {options.length === 0 ? <div className="ms-empty">No options</div> : null}
            {options.map((opt) => {
              const text = String(opt);
              const checked = normalized.has(text);
              return (
                <label key={text} className="ms-option">
                  <input type="checkbox" checked={checked} onChange={() => toggleValue(text)} />
                  <span>{text}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_FORM = {
  email: "",
  authProvider: "google",
  password: "",
  role: "user",
  fullAccess: false,
  allowedCountries: [],
  allowedAdops: [],
  allowedTabs: ["overview", "management"]
};

export default function AdminSetup({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ countries: [], adops: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEmail, setEditingEmail] = useState("");
  const [msg, setMsg] = useState("");

  const loadAll = async () => {
    const [u, o] = await Promise.all([
      axios.get("/api/admin/users", { timeout: 6000 }),
      axios.get("/api/admin/options", { timeout: 6000 })
    ]);
    setUsers(u.data || []);
    setOptions({ countries: o.data?.countries || [], adops: o.data?.adops || [] });
  };

  useEffect(() => {
    loadAll().catch(() => setMsg("Failed to load admin data"));
  }, []);

  const tabsList = useMemo(() => ["overview", "management", "admin"], []);

  const saveAccess = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const payload = {
        ...form,
        email: String(form.email || "").trim().toLowerCase()
      };
      if (!payload.email) throw new Error("Email is required");

      if (editingEmail) {
        await axios.put(`/api/admin/users/${encodeURIComponent(editingEmail)}`, payload, { timeout: 6000 });
        setMsg("Access updated");
      } else {
        await axios.post("/api/admin/users", payload, { timeout: 6000 });
        setMsg("Access added");
      }
      setForm(EMPTY_FORM);
      setEditingEmail("");
      await loadAll();
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Failed to save access");
    }
  };

  const editUser = (user) => {
    setEditingEmail(user.email || user.username);
    setForm({
      email: user.email || user.username || "",
      authProvider: user.authProvider || "google",
      password: "",
      role: user.role || "user",
      fullAccess: Boolean(user.fullAccess),
      allowedCountries: user.allowedCountries || [],
      allowedAdops: user.allowedAdops || [],
      allowedTabs: user.allowedTabs || ["overview", "management"]
    });
  };

  const deleteUser = async (email) => {
    try {
      await axios.delete(`/api/admin/users/${encodeURIComponent(email)}`, { timeout: 6000 });
      await loadAll();
    } catch (err) {
      setMsg(err.response?.data?.error || "Failed to delete user");
    }
  };

  const toggleTab = (tab) => {
    setForm((prev) => {
      const has = prev.allowedTabs.includes(tab);
      const next = has ? prev.allowedTabs.filter((t) => t !== tab) : [...prev.allowedTabs, tab];
      return { ...prev, allowedTabs: next.length ? next : ["overview"] };
    });
  };

  return (
    <AppLayout currentUser={currentUser} onLogout={onLogout}>
      <DashboardHeader activeTab="admin" currentUser={currentUser} onLogout={onLogout} />
      <div className="admin-page">
        <div className="admin-head">
          <h2>Admin Setup</h2>
          <p>Allow company emails and assign role, scope, and section access.</p>
        </div>
        {msg ? <div className="admin-msg">{msg}</div> : null}

        <form onSubmit={saveAccess} className="admin-card admin-form">
          <h3>{editingEmail ? `Edit Access: ${editingEmail}` : "Allow Email Access"}</h3>
          <div className="admin-grid">
            <div>
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                disabled={Boolean(editingEmail)}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="admin-input"
              />
            </div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="admin-input">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label>Login Method</label>
              <select value={form.authProvider} onChange={(e) => setForm((p) => ({ ...p, authProvider: e.target.value }))} className="admin-input">
                <option value="google">Google SSO</option>
                <option value="microsoft">Microsoft SSO</option>
                <option value="local">Manual Password</option>
              </select>
            </div>
            <div>
              <label>Password {form.authProvider === "local" ? "(required for new local user)" : "(not used for SSO)"}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                disabled={form.authProvider !== "local"}
                className="admin-input"
              />
            </div>
            <div className="admin-check-row">
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.fullAccess}
                  onChange={(e) => setForm((p) => ({ ...p, fullAccess: e.target.checked }))}
                />
                Allow everything (no country/adops restrictions)
              </label>
            </div>
            <MultiSelectDropdown
              label="Allowed Countries"
              options={options.countries}
              value={form.allowedCountries}
              disabled={form.fullAccess}
              onChange={(vals) => setForm((p) => ({ ...p, allowedCountries: vals }))}
              placeholder="Select countries"
            />
            <MultiSelectDropdown
              label="Allowed AdOps"
              options={options.adops}
              value={form.allowedAdops}
              disabled={form.fullAccess}
              onChange={(vals) => setForm((p) => ({ ...p, allowedAdops: vals }))}
              placeholder="Select AdOps"
            />
            <div className="admin-tabs-row">
              <label>Allowed Sections</label>
              <div className="admin-tabs">
                {tabsList.map((tab) => (
                  <label key={tab}>
                    <input type="checkbox" checked={form.allowedTabs.includes(tab)} onChange={() => toggleTab(tab)} /> {tab}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" className="admin-btn primary">{editingEmail ? "Update Access" : "Allow Email"}</button>
          {editingEmail ? (
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setEditingEmail("");
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>

        <div className="admin-card">
          <h3>Allowed Emails</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th align="left">Email</th>
                <th align="left">Role</th>
                <th align="left">Login</th>
                <th align="left">Full Access</th>
                <th align="left">Countries</th>
                <th align="left">AdOps</th>
                <th align="left">Tabs</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const email = u.email || u.username;
                return (
                  <tr key={email}>
                    <td>{email}</td>
                    <td>{u.role}</td>
                    <td>{u.authProvider || "google"}</td>
                    <td>{u.fullAccess ? "Yes" : "No"}</td>
                    <td>{(u.allowedCountries || []).join(", ") || "All"}</td>
                    <td>{(u.allowedAdops || []).join(", ") || "All"}</td>
                    <td>{(u.allowedTabs || []).join(", ")}</td>
                    <td>
                      <button type="button" className="admin-btn sm" onClick={() => editUser(u)}>Edit</button>
                      {String(u.username).toLowerCase() === "admin" ? "Locked" : (
                        <button type="button" className="admin-btn sm danger" onClick={() => deleteUser(email)}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}


