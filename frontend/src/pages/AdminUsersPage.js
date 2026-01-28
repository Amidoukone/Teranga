// ============================================================================
// AdminUsersPage.jsx — Apple Light Premium B2 Minimal
// Version 2025 — ADMIN GLOBAL & MASTER (admin + geo scope)
// BACKEND SOURCE OF TRUTH • ZERO REGRESSION
//
// 🔒 Sécurité ajoutée (2026):
// - Un MASTER ne peut PAS créer ni promouvoir un admin
// - Seul l'ADMIN GLOBAL peut créer admin / master
// - Double verrou UI + payload (anti-DOM hack)
// - Un MASTER ne peut pas éditer/supprimer un admin existant (UI + guard)
// ============================================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "../services/users";
import { me } from "../services/auth";
import { motion } from "framer-motion";
import { normalizeRole, isMasterUser, prettyRoleLabel } from "../utils/role";
import { useGeo } from "../contexts/GeoContext";

/* ============================================================
   Helpers locaux (safe, non cassants)
============================================================ */
function toSafeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}
function toSafeIntOrEmpty(v) {
  const s = toSafeStr(v).trim();
  if (!s) return "";
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? "" : String(n);
}
function upper2(v) {
  return toSafeStr(v).trim().toUpperCase().slice(0, 2);
}
function extractApiError(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "Erreur lors de la soumission"
  );
}

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  const [role, setRole] = useState("client");
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem("teranga_admin_users_showForm");
    return saved === null ? true : saved === "1";
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    country: "",
    role: "client",

    // Legacy (présent, mais non utilisé par défaut)
    scopeCountry: "",
    scopeRegion: "",

    // ✅ Sélection guidée (IDs) pour admins (GLOBAL uniquement)
    scopeCountryId: "",
    scopeRegionId: "",
  });

  const [editing, setEditing] = useState(null);

  const [filters, setFilters] = useState({
    q: "",
    country: "",
    onlyPhone: false,
    sort: "-createdAt",
    adminType: "all",
  });

  const {
    countryId: geoCountryId,
    regionId: geoRegionId,
    countries,
    regions,
    isScopedRole,
    canSelect,
  } = useGeo();

  const isMaster = isMasterUser(currentUser);
  const isGlobalAdmin = Boolean(currentUser && normalizeRole(currentUser.role) === "admin" && !isMaster);

  const geoCountry = (countries || []).find((c) => String(c.id) === String(geoCountryId));
  const geoRegion = (regions || []).find((r) => String(r.id) === String(geoRegionId));

  // ============================================================
  // 🔐 AUTH CHECK
  // ============================================================
  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await me();
        if (!active) return;

        const user = res?.user;
        if (!user || normalizeRole(user.role) !== "admin") {
          window.location.href = "/dashboard";
          return;
        }

        setCurrentUser(user);
        setIsAdmin(true);
      } catch (e) {
        console.error("❌ /me error:", e);
        window.location.href = "/login";
      }
    }

    check();
    return () => {
      active = false;
    };
  }, []);

  // ============================================================
  // 🔄 LOAD USERS
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(role, {
        adminType: role === "admin" && isGlobalAdmin ? filters.adminType : undefined,
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Load users error:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters.adminType, isGlobalAdmin, role]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // ============================================================
  // 💾 Persist form visibility
  // ============================================================
  useEffect(() => {
    localStorage.setItem("teranga_admin_users_showForm", showForm ? "1" : "0");
  }, [showForm]);

  // ============================================================
  // 🌍 Regions filtrées par le pays sélectionné (form)
  // ============================================================
  const formRegions = useMemo(() => {
    const cid = toSafeIntOrEmpty(form.scopeCountryId);
    if (!cid) return [];
    return (regions || []).filter((r) => String(r.countryId) === String(cid));
  }, [regions, form.scopeCountryId]);

  // ============================================================
  // 🔎 FILTERING (local) + tri
  // ============================================================
  useEffect(() => {
    let arr = [...users];

    // Filtre GeoContext (si présent)
    if (geoRegionId) {
      arr = arr.filter((u) => String(u.regionId ?? "") === String(geoRegionId));
    } else if (geoCountryId) {
      arr = arr.filter((u) => String(u.countryId ?? "") === String(geoCountryId));
    }

    if (filters.q.trim()) {
      const q = filters.q.toLowerCase();
      arr = arr.filter((u) =>
        [u.firstName, u.lastName, u.email, u.phone, u.country, u.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.country.trim()) {
      const c = filters.country.trim().toUpperCase().slice(0, 2);
      arr = arr.filter((u) => (u.country || "").toUpperCase() === c);
    }

    if (filters.onlyPhone) {
      arr = arr.filter((u) => !!u.phone);
    }

    // Tri
    const sign = filters.sort.startsWith("-") ? -1 : 1;
    const key = filters.sort.replace("-", "");
    arr.sort((a, b) => {
      const va =
        key === "createdAt"
          ? new Date(a.createdAt || 0).getTime()
          : (a[key] || "").toString().toLowerCase();
      const vb =
        key === "createdAt"
          ? new Date(b.createdAt || 0).getTime()
          : (b[key] || "").toString().toLowerCase();
      return va < vb ? -sign : va > vb ? sign : 0;
    });

    setFiltered(arr);
  }, [users, filters, geoCountryId, geoRegionId]);

  // ============================================================
  // 🧠 PAYLOAD BUILDER — DOUBLE VERROU (UI + anti-DOM hack)
  // ============================================================
  function buildPayload() {
    const payload = {};

    ["firstName", "lastName", "email", "phone", "country"].forEach((k) => {
      const val = form[k];
      if (k === "country") {
        const iso2 = upper2(val);
        if (iso2) payload.country = iso2;
        return;
      }
      if (toSafeStr(val).trim()) payload[k] = toSafeStr(val).trim();
    });

    // 🔒 ROLE SECURITY (anti hack DOM)
    const targetRole = normalizeRole(form.role);

    // MASTER => interdit admin
    if (isMaster && targetRole === "admin") {
      const err = new Error("⛔ Un ADMIN MASTER ne peut pas créer ou promouvoir un compte admin.");
      err.status = 403;
      throw err;
    }

    payload.role = targetRole;

    // Création : password requis
    if (!editing && !toSafeStr(form.password).trim()) {
      const err = new Error("Mot de passe requis à la création.");
      err.status = 400;
      throw err;
    }

    // Update : password optionnel
    if (toSafeStr(form.password).trim()) {
      payload.password = toSafeStr(form.password);
    }

    // Scope admin (IDs only) — seulement GLOBAL admin
    if (targetRole === "admin" && !isMaster) {
      const cid = toSafeIntOrEmpty(form.scopeCountryId);
      const rid = toSafeIntOrEmpty(form.scopeRegionId);

      if (rid) payload.regionId = Number(rid);
      else if (cid) payload.countryId = Number(cid);
      // vide = admin global
    }

    return payload;
  }

  // ============================================================
  // 🚀 SUBMIT
  // ============================================================
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = buildPayload();

      if (editing) {
        await updateUser(editing, payload);
        alert("✅ Utilisateur mis à jour");
      } else {
        await createUser(payload);
        alert("✅ Utilisateur créé");
      }

      resetForm();
      await load();
    } catch (err) {
      alert(extractApiError(err));
      console.error("❌ Submit error:", err);
    }
  }

  function resetForm() {
    setEditing(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      country: "",
      role: "client",
      scopeCountry: "",
      scopeRegion: "",
      scopeCountryId: "",
      scopeRegionId: "",
    });
  }

  function handleEdit(u) {
    // 🔒 MASTER ne peut pas éditer un admin existant
    if (isMaster && normalizeRole(u.role) === "admin") {
      alert("⛔ Impossible de modifier un admin en tant que MASTER.");
      return;
    }

    setEditing(u.id);
    setShowForm(true);

    setForm({
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email || "",
      phone: u.phone || "",
      country: upper2(u.country || ""),
      role: u.role,
      password: "",

      scopeCountry: "",
      scopeRegion: "",

      scopeCountryId: u.countryId != null ? String(u.countryId) : "",
      scopeRegionId: u.regionId != null ? String(u.regionId) : "",
    });
  }

  async function handleDelete(u) {
    // 🔒 MASTER ne peut pas supprimer un admin
    if (isMaster && normalizeRole(u.role) === "admin") {
      alert("⛔ Impossible de supprimer un admin en tant que MASTER.");
      return;
    }
    if (!window.confirm("Supprimer cet utilisateur ?")) return;

    try {
      await deleteUser(u.id);
      alert("✅ Utilisateur supprimé");
      await load();
    } catch (err) {
      alert(extractApiError(err));
      console.error("❌ Delete error:", err);
    }
  }

  // ============================================================
  // ⏳ LOADING GUARD
  // ============================================================
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 animate-pulse">Chargement…</p>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea] px-4 py-10 font-[system-ui] text-[#1c1c1e]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto bg-white shadow-xl rounded-3xl p-8 border border-gray-200"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              👥 Gestion des utilisateurs
            </h1>

            {/* ✅ Info scope + badges */}
            {currentUser && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {/* Badge rôle */}
                  <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                    {prettyRoleLabel(currentUser)}
                  </span>

                  {/* Badge MASTER / GLOBAL */}
                  {normalizeRole(currentUser?.role) === "admin" && (
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs ${
                        isMaster
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                      title={isMaster ? "Admin MASTER (scopé)" : "Admin GLOBAL"}
                    >
                      {isMaster ? "MASTER" : "GLOBAL"}
                    </span>
                  )}

                  {/* Périmètre */}
                  {isMaster && (
                    <span className="text-gray-500">
                      Périmètre :
                      {currentUser?.countryId != null ? ` Pays #${currentUser.countryId}` : ""}
                      {currentUser?.regionId != null ? ` · Région #${currentUser.regionId}` : ""}
                    </span>
                  )}

                  {!isMaster && <span className="text-gray-500">Accès global</span>}

                  {/* Filtre GeoContext */}
                  {geoCountryId && !isScopedRole && (
                    <span className="text-gray-500">
                      Filtre: {geoCountry?.name || `Pays #${geoCountryId}`}
                      {geoRegionId ? ` · ${geoRegion?.name || `Région #${geoRegionId}`}` : ""}
                      {canSelect ? " (sélection)" : ""}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-5 py-2 rounded-full bg-[#1c1c1e] text-white text-sm font-medium shadow hover:bg-black transition"
            >
              {showForm ? "➖ Masquer" : "➕ Créer utilisateur"}
            </button>

            <button
              onClick={load}
              disabled={loading}
              className={`px-5 py-2 rounded-full text-sm font-medium shadow transition ${
                loading
                  ? "bg-[#0a84ff]/40 cursor-not-allowed text-white"
                  : "bg-[#0a84ff] text-white hover:bg-[#0066cc]"
              }`}
            >
              {loading ? "Chargement…" : "🔄 Rafraîchir"}
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="mb-6 bg-[#f8f8fa] border border-gray-200 rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* Rôle */}
            <div>
              <label className="text-xs font-medium text-gray-600">Catégorie</label>
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setRole(nextRole);
                  if (nextRole !== "admin") {
                    setFilters((prev) => ({ ...prev, adminType: "all" }));
                  }
                }}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              >
                <option value="client">Clients</option>
                <option value="agent">Agents</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Type d'admin (GLOBAL uniquement) */}
            {role === "admin" && isGlobalAdmin && (
              <div>
                <label className="text-xs font-medium text-gray-600">Type d’admin</label>
                <select
                  value={filters.adminType}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      adminType: e.target.value,
                    })
                  }
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
                >
                  <option value="all">Tous</option>
                  <option value="master">Masters (scopés)</option>
                  <option value="global">Admins globaux</option>
                </select>
              </div>
            )}

            {/* Recherche */}
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-gray-600">Recherche</label>
              <input
                placeholder="Nom, email, téléphone…"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              />
            </div>

            {/* Pays */}
            <div>
              <label className="text-xs font-medium text-gray-600">Pays (ISO2)</label>
              <input
                placeholder="SN, ML, FR…"
                value={filters.country}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              />
            </div>

            {/* Checkbox */}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.onlyPhone}
                  onChange={(e) => setFilters({ ...filters, onlyPhone: e.target.checked })}
                />
                Avec téléphone
              </label>
            </div>

            {/* Tri */}
            <div>
              <label className="text-xs font-medium text-gray-600">Tri</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="firstName">Prénom A→Z</option>
                <option value="-firstName">Prénom Z→A</option>
                <option value="email">Email A→Z</option>
                <option value="-email">Email Z→A</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-between text-xs text-gray-500">
            <span>{filtered.length} utilisateur(s)</span>
            <button
              onClick={() =>
                setFilters({
                  q: "",
                  country: "",
                  onlyPhone: false,
                  sort: "-createdAt",
                  adminType: "all",
                })
              }
              className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* FORMULAIRE */}
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f8f8fa] p-6 rounded-2xl border border-gray-200 mb-10"
          >
            {[
              ["firstName", "Prénom"],
              ["lastName", "Nom"],
              ["phone", "Téléphone"],
              ["country", "Pays (ISO2)"],
            ].map(([key, label]) => (
              <input
                key={key}
                placeholder={label}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              />
            ))}

            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="md:col-span-2 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <input
              placeholder="Mot de passe (laisser vide si inchangé)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="md:col-span-2 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            {/* ✅ ROLE SELECT — MASTER: client/agent only */}
            <select
              value={form.role}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value,
                  scopeCountryId: "",
                  scopeRegionId: "",
                  scopeCountry: "",
                  scopeRegion: "",
                })
              }
              className="md:col-span-2 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            >
              <option value="client">Client</option>
              <option value="agent">Agent</option>
              {isGlobalAdmin && <option value="admin">Admin</option>}
            </select>

            {/* ✅ ADMIN: Sélection guidée pays/région (IDs) — uniquement GLOBAL */}
            {isGlobalAdmin && normalizeRole(form.role) === "admin" && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Périmètre pays</label>
                  <select
                    value={form.scopeCountryId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scopeCountryId: e.target.value,
                        scopeRegionId: "",
                      })
                    }
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
                  >
                    <option value="">— Admin global (aucun périmètre) —</option>
                    {(countries || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.isoCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Périmètre région (optionnel)</label>
                  <select
                    value={form.scopeRegionId}
                    disabled={!form.scopeCountryId || formRegions.length === 0}
                    onChange={(e) => setForm({ ...form, scopeRegionId: e.target.value })}
                    className={`mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff] ${
                      !form.scopeCountryId || formRegions.length === 0 ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="">
                      {form.scopeCountryId
                        ? "— MASTER pays (toutes régions) —"
                        : "— Choisir d'abord un pays —"}
                    </option>
                    {formRegions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.code ? `(${r.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="md:col-span-2 text-xs text-gray-500">
                  ℹ️ Pour créer un <strong>MASTER</strong>, sélectionne un pays (MASTER pays)
                  ou un pays + une région (MASTER régional). Laisser vide = admin global.
                </p>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-full bg-gray-300 hover:bg-gray-400 text-sm"
                >
                  Annuler
                </button>
              )}

              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#0a84ff] text-white text-sm font-medium hover:bg-[#0066cc]"
              >
                {editing ? "💾 Mettre à jour" : "➕ Créer"}
              </button>
            </div>
          </motion.form>
        )}

        {/* TABLE */}
        {loading ? (
          <p className="text-center text-gray-500 py-6">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-6">Aucun utilisateur.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  {["Nom", "Email", "Téléphone", "Pays", "Rôle", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((u) => {
                  const uRole = normalizeRole(u.role);
                  const isAdminRow = uRole === "admin";
                  const actionsLocked = isMaster && isAdminRow;

                  return (
                    <tr
                      key={u.id}
                      className="bg-white hover:bg-gray-50 transition border border-gray-200 rounded-xl"
                    >
                      <td className="px-4 py-2">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">{u.phone || "—"}</td>
                      <td className="px-4 py-2">{u.country || "—"}</td>
                      <td className="px-4 py-2 uppercase">{prettyRoleLabel(u)}</td>

                      <td className="px-4 py-2 flex gap-3 items-center">
                        <button
                          onClick={() => handleEdit(u)}
                          className={`${
                            actionsLocked
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-[#ca8a04] hover:text-[#b45309]"
                          }`}
                          title={
                            actionsLocked
                              ? "Verrouillé pour MASTER"
                              : "Modifier"
                          }
                          disabled={actionsLocked}
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => handleDelete(u)}
                          className={`${
                            actionsLocked
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-600 hover:text-red-800"
                          }`}
                          title={
                            actionsLocked
                              ? "Verrouillé pour MASTER"
                              : "Supprimer"
                          }
                          disabled={actionsLocked}
                        >
                          🗑️
                        </button>

                        {actionsLocked && (
                          <span className="text-[11px] text-gray-400">
                            (admin protégé)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-xs text-gray-500 mt-4">{filtered.length} résultat(s)</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
