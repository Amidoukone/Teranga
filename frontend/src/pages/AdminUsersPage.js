// ============================================================================
// AdminUsersPage.jsx — Apple Light Premium B2 Minimal
// Version 2025 : professionnelle, élégante, lisible, sans aucune régression.
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../services/users";
import { me } from "../services/auth";
import { motion } from "framer-motion";

export default function AdminUsersPage() {
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
  });
  const [editing, setEditing] = useState(null);

  const [filters, setFilters] = useState({
    q: "",
    country: "",
    onlyPhone: false,
    sort: "-createdAt",
  });

  // ============================================================================
  // 🔄 LOAD USERS
  // ============================================================================
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(role);
      setUsers(data || []);
    } catch (err) {
      console.error("❌ Erreur chargement utilisateurs:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  // ============================================================================
  // 🔐 CHECK ADMIN + INIT LOAD
  // ============================================================================
  useEffect(() => {
    async function check() {
      const { user } = await me();
      if (user.role !== "admin") window.location.href = "/dashboard";
    }
    check();
    load();
  }, [load]);

  // ============================================================================
  // 💾 Save form visibility
  // ============================================================================
  useEffect(() => {
    localStorage.setItem("teranga_admin_users_showForm", showForm ? "1" : "0");
  }, [showForm]);

  // ============================================================================
  // 🔎 FILTERING + SORTING
  // ============================================================================
  useEffect(() => {
    let arr = [...users];

    if (filters.q.trim()) {
      const q = filters.q.toLowerCase();
      arr = arr.filter((u) =>
        [
          u.firstName,
          u.lastName,
          u.email,
          u.phone,
          u.country,
          u.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.country.trim()) {
      const c = filters.country.trim().toUpperCase();
      arr = arr.filter((u) => (u.country || "").toUpperCase() === c);
    }

    if (filters.onlyPhone) {
      arr = arr.filter((u) => !!u.phone);
    }

    const by = filters.sort;
    arr.sort((a, b) => {
      const sign = by.startsWith("-") ? -1 : 1;
      const key = by.replace(/^-/, "");

      let va, vb;

      if (key === "createdAt") {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else {
        va = (a[key] || "").toString().toLowerCase();
        vb = (b[key] || "").toString().toLowerCase();
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [users, filters]);

  // ============================================================================
  // SUBMIT FORM
  // ============================================================================
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await updateUser(editing, form);
        alert("✅ Utilisateur mis à jour");
      } else {
        await createUser(form);
        alert("✅ Utilisateur créé");
      }
      resetForm();
      await load();
    } catch (err) {
      console.error("❌ Erreur soumission:", err);
      alert("Erreur lors de la soumission du formulaire.");
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
      role,
    });
  }

  function handleEdit(u) {
    setEditing(u.id);
    setShowForm(true);
    setForm({
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email || "",
      phone: u.phone || "",
      country: (u.country || "").toUpperCase().slice(0, 2),
      role: u.role,
      password: "",
    });
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      await deleteUser(id);
      alert("✅ Utilisateur supprimé");
      await load();
    } catch (err) {
      console.error("❌ Erreur suppression:", err);
      alert("Erreur lors de la suppression.");
    }
  }

  // ============================================================================
  // UI — APPLE LIGHT PREMIUM
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea] px-4 py-10 font-[system-ui] text-[#1c1c1e]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto bg-white shadow-xl rounded-3xl p-8 border border-gray-200"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            👥 Gestion des utilisateurs
          </h1>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Rôle */}
            <div>
              <label className="text-xs font-medium text-gray-600">Catégorie</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              >
                <option value="client">Clients</option>
                <option value="agent">Agents</option>
                <option value="admin">Admins</option>
              </select>
            </div>

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
                  onChange={(e) =>
                    setFilters({ ...filters, onlyPhone: e.target.checked })
                  }
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

          {/* Footer */}
          <div className="mt-3 flex justify-between text-xs text-gray-500">
            <span>{filtered.length} utilisateur(s)</span>

            <button
              onClick={() =>
                setFilters({
                  q: "",
                  country: "",
                  onlyPhone: false,
                  sort: "-createdAt",
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
                onChange={(e) =>
                  setForm({ ...form, [key]: e.target.value })
                }
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

            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="md:col-span-2 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            >
              <option value="client">Client</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>

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
                  {["Nom", "Email", "Téléphone", "Pays", "Rôle", "Actions"].map(
                    (h) => (
                      <th key={h} className="text-left px-4 py-2 font-medium">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {filtered.map((u) => (
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
                    <td className="px-4 py-2 uppercase">{u.role}</td>

                    <td className="px-4 py-2 flex gap-3">
                      <button
                        onClick={() => handleEdit(u)}
                        className="text-[#ca8a04] hover:text-[#b45309]"
                        title="Modifier"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-gray-500 mt-4">
              {filtered.length} résultat(s)
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
