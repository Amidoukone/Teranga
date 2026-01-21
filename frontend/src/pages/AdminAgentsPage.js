// frontend/src/pages/AdminAgentsPage.jsx
// ============================================================================
// AdminAgentsPage — VERSION PROD 2025
// Admin / Master (multi-pays) READY — ZERO RÉGRESSION
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import api from "../services/api";

/* ============================================================================
// 🔐 CONSTANTES
============================================================================ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================================
// 🧩 PAGE PRINCIPALE
============================================================================ */
export default function AdminAgentsPage() {
  /* --------------------------------------------------------------------------
   * STATE FORM
   * ------------------------------------------------------------------------ */
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    country: "",
  });

  const [errors, setErrors] = useState({});

  /* --------------------------------------------------------------------------
   * STATE DATA
   * ------------------------------------------------------------------------ */
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  /* --------------------------------------------------------------------------
   * UI STATE
   * ------------------------------------------------------------------------ */
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem("teranga_admin_agents_showForm");
    return saved === null ? true : saved === "1";
  });

  /* --------------------------------------------------------------------------
   * FILTERS
   * ------------------------------------------------------------------------ */
  const [filters, setFilters] = useState({
    q: "",
    country: "",
    onlyPhone: false,
    sort: "-createdAt",
  });

  /* ========================================================================
   * VALIDATION
   * ====================================================================== */
  function validate() {
    const e = {};

    if (!form.firstName.trim()) e.firstName = "Prénom requis";
    if (!form.lastName.trim()) e.lastName = "Nom requis";

    const email = form.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) e.email = "Email invalide";

    if (!form.password || String(form.password).length < 6) {
      e.password = "Mot de passe requis (6 caractères min.)";
    }

    const country = (form.country || "").trim().toUpperCase();
    if (!country || country.length !== 2) {
      e.country = "Code pays ISO2 requis (ex: ML, FR)";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(field, value) {
    if (field === "country") {
      value = (value || "").toUpperCase().slice(0, 2);
    }
    if (field === "email") {
      value = (value || "").toLowerCase();
    }

    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /* ========================================================================
   * LOAD AGENTS (ADMIN / MASTER — scope backend)
   * ====================================================================== */
  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      // 🔒 Le backend applique déjà le scope multi-pays pour MASTER
      const { data } = await api.get("/users?role=agent");
      setAgents(data?.users || []);
    } catch (err) {
      console.error("❌ Erreur chargement agents:", err);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    localStorage.setItem(
      "teranga_admin_agents_showForm",
      showForm ? "1" : "0"
    );
  }, [showForm]);

  /* ========================================================================
   * FILTERING & SORTING — CLIENT SIDE (SAFE)
   * ====================================================================== */
  useEffect(() => {
    let arr = [...agents];

    // Recherche globale
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((a) =>
        [
          a.firstName,
          a.lastName,
          a.email,
          a.phone,
          a.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    // Filtre pays
    if (filters.country.trim()) {
      const cc = filters.country.toUpperCase();
      arr = arr.filter(
        (a) => (a.country || "").toUpperCase() === cc
      );
    }

    // Avec téléphone uniquement
    if (filters.onlyPhone) {
      arr = arr.filter((a) => !!a.phone);
    }

    // Tri
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
  }, [agents, filters]);

  /* ========================================================================
   * SUBMIT CREATE AGENT
   * ====================================================================== */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      await api.post("/users/agents", {
        email: form.email.trim().toLowerCase(),
        password: String(form.password),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country.trim().toUpperCase(),
      });

      alert("✅ Agent créé avec succès");

      setForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phone: "",
        country: "",
      });

      setErrors({});
      await loadAgents();
    } catch (err) {
      console.error("❌ Erreur création agent:", err);
      const msg =
        err?.response?.data?.error ||
        "Erreur lors de la création";
      alert(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  /* ========================================================================
   * UI RENDER — PREMIUM PROD (APPLE LIGHT A1)
   * ====================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/40 to-white px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-lg shadow-slate-200/40 rounded-3xl p-8 border border-slate-200">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            👤 Gestion des Agents
          </h1>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              {showForm ? "➖ Masquer" : "➕ Ajouter"}
            </button>

            <button
              onClick={loadAgents}
              disabled={loadingAgents}
              className={`px-4 py-2 rounded-xl text-white transition ${
                loadingAgents
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loadingAgents ? "Chargement…" : "🔄 Rafraîchir"}
            </button>
          </div>
        </div>

        {/* ================= FILTRES ================= */}
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

            {/* Recherche */}
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1">
                Recherche
              </label>
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters({ ...filters, q: e.target.value })
                }
                placeholder="Nom, email, téléphone…"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pays */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1">
                Pays (ISO2)
              </label>
              <input
                value={filters.country}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                placeholder="ML, FR…"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Téléphone */}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.onlyPhone}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      onlyPhone: e.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                Avec téléphone
              </label>
            </div>

            {/* Tri */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1">
                Tri
              </label>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="firstName">Nom A→Z</option>
                <option value="-firstName">Nom Z→A</option>
                <option value="email">Email A→Z</option>
                <option value="-email">Email Z→A</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {filtered.length} agent(s)
            </span>
            <button
              onClick={() =>
                setFilters({
                  q: "",
                  country: "",
                  onlyPhone: false,
                  sort: "-createdAt",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 transition"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* ================= FORMULAIRE ================= */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-sm"
          >
            {[
              { field: "firstName", label: "Prénom *", type: "text" },
              { field: "lastName", label: "Nom *", type: "text" },
              { field: "email", label: "Email *", type: "email" },
              {
                field: "password",
                label: "Mot de passe (≥ 6) *",
                type: "password",
              },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className="text-xs font-medium text-slate-700">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) =>
                    handleChange(field, e.target.value)
                  }
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
                />
                {errors[field] && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}

            {/* Téléphone */}
            <div>
              <label className="text-xs font-medium text-slate-700">
                Téléphone
              </label>
              <input
                value={form.phone}
                onChange={(e) =>
                  handleChange("phone", e.target.value)
                }
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pays */}
            <div>
              <label className="text-xs font-medium text-slate-700">
                Pays (ISO2) *
              </label>
              <input
                value={form.country}
                maxLength={2}
                onChange={(e) =>
                  handleChange("country", e.target.value)
                }
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500"
              />
              {errors.country && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.country}
                </p>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2.5 rounded-xl shadow-sm text-white text-sm font-medium transition ${
                  loading
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? "Création…" : "Créer Agent"}
              </button>
            </div>
          </form>
        )}

        {/* ================= TABLEAU ================= */}
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          📋 Liste des agents
        </h2>

        {loadingAgents ? (
          <p className="text-center text-slate-500 italic py-6">
            Chargement des agents…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 italic py-6">
            Aucun agent trouvé.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/60 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nom</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                  <th className="px-4 py-3 text-left font-medium">Pays</th>
                  <th className="px-4 py-3 text-left font-medium">Créé le</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 border-b border-slate-100 transition"
                  >
                    <td className="px-4 py-3">
                      {[a.firstName, a.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3">{a.phone || "—"}</td>
                    <td className="px-4 py-3">{a.country || "—"}</td>
                    <td className="px-4 py-3">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-2 text-xs text-slate-500">
              {filtered.length} résultat(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
  