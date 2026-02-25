// frontend/src/pages/AdminAgentsPage.jsx
// ============================================================================
// AdminAgentsPage AAAasAAaA VERSION PROD 2025
// Admin / Master (multi-pays) READY AAAasAAaA ZERO RAAaAGRESSION
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { mergeGeoPayload } from "../services/geo";
import { useGeo } from "../contexts/GeoContext";
import { useLocale } from "../i18n/useLocale";
import { useTranslation } from "react-i18next";
import { notify } from '../utils/notify';

/* ============================================================================
// AAA...A AaAAA CONSTANTES
============================================================================ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================================
// AAA...A AAAA PAGE PRINCIPALE
============================================================================ */
export default function AdminAgentsPage() {
  const { t } = useTranslation();
  const { formatDate } = useLocale();
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

  const {
    countryId: geoCountryId,
    regionId: geoRegionId,
    countries,
    regions,
    isScopedRole,
    canSelect,
  } = useGeo();

  const geoCountry = countries?.find((c) => String(c.id) === String(geoCountryId));
  const geoRegion = regions?.find((r) => String(r.id) === String(geoRegionId));

  /* ========================================================================
   * VALIDATION
   * ====================================================================== */
  function validate() {
    const e = {};

    if (!form.firstName.trim()) e.firstName = t("adminAgentsPage.validation.firstNameRequired");
    if (!form.lastName.trim()) e.lastName = t("adminAgentsPage.validation.lastNameRequired");

    const email = form.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) e.email = t("adminAgentsPage.validation.emailInvalid");

    if (!form.password || String(form.password).length < 6) {
      e.password = t("adminAgentsPage.validation.passwordRequired");
    }

    const country = (form.country || "").trim().toUpperCase();
    if (!country || country.length !== 2) {
      e.country = t("adminAgentsPage.validation.countryInvalid");
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
 * LOAD AGENTS (ADMIN / MASTER AAAasAAaA scope backend)
   * ====================================================================== */
  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
 // AAA...A AaAAaa Le backend applique dAAAjAAA le scope multi-pays pour MASTER
      const { data } = await api.get("/users?role=agent");
      setAgents(data?.users || []);
    } catch (err) {
      console.error("Erreur chargement agents:", err);
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
 * FILTERING & SORTING AAAasAAaA CLIENT SIDE (SAFE)
   * ====================================================================== */
  useEffect(() => {
    let arr = [...agents];

    if (geoRegionId) {
      arr = arr.filter((a) => String(a.regionId ?? "") === String(geoRegionId));
    } else if (geoCountryId) {
      arr = arr.filter((a) => String(a.countryId ?? "") === String(geoCountryId));
    }

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

 // Avec tAAAlAAAphone uniquement
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
  }, [agents, filters, geoCountryId, geoRegionId]);

  /* ========================================================================
   * SUBMIT CREATE AGENT
   * ====================================================================== */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      await api.post(
        "/users/agents",
        mergeGeoPayload({
          email: form.email.trim().toLowerCase(),
          password: String(form.password),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || undefined,
          country: form.country.trim().toUpperCase(),
        })
      );

      notify(t("adminAgentsPage.alerts.createSuccess"));

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
      console.error("Erreur creation agent:", err);
      const msg =
        err?.response?.data?.error ||
        t("adminAgentsPage.alerts.createError");
      notify(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ========================================================================
 * UI RENDER AAAasAAaA PREMIUM PROD (APPLE LIGHT A1)
   * ====================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-10">
      <div className="max-w-6xl mx-auto bg-surface-card shadow-lg shadow-slate-200/40 rounded-3xl p-8 border border-border">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-text-primary tracking-tight">
              {t("adminAgentsPage.title")}
            </h1>
            {geoCountryId && !isScopedRole && (
              <p className="text-xs text-text-muted mt-1">
                {t("adminAgentsPage.labels.filter")}{" "}
                {geoCountry?.name ||
                  t("adminAgentsPage.labels.countryId", { id: geoCountryId })}
                {geoRegionId
                  ? ` \u00B7 ${
                      geoRegion?.name ||
                      t("adminAgentsPage.labels.regionId", { id: geoRegionId })
                    }`
                  : ""}
                {canSelect ? ` ${t("adminAgentsPage.labels.selection")}` : ""}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-xl app-btn-neutral transition"
            >
              {showForm
                ? t("adminAgentsPage.buttons.hideForm")
                : t("adminAgentsPage.buttons.showForm")}
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
              {loadingAgents
                ? t("adminAgentsPage.loading")
                : t("adminAgentsPage.buttons.refresh")}
            </button>
          </div>
        </div>

        {/* ================= FILTRES ================= */}
        <div className="mb-8 bg-surface-main border border-border rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

            {/* Recherche */}
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-text-secondary mb-1">
                {t("adminAgentsPage.filters.search")}
              </label>
              <input
                value={filters.q}
                onChange={(e) =>
                  setFilters({ ...filters, q: e.target.value })
                }
                placeholder={t("adminAgentsPage.placeholders.search")}
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pays */}
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1">
                {t("adminAgentsPage.filters.country")}
              </label>
              <input
                value={filters.country}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                placeholder={t("adminAgentsPage.placeholders.country")}
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
            </div>

 {/* TAAAlAAAphone */}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
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
                {t("adminAgentsPage.filters.withPhone")}
              </label>
            </div>

            {/* Tri */}
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1">
                {t("adminAgentsPage.filters.sort")}
              </label>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              >
                <option value="-createdAt">{t("adminAgentsPage.filters.sortOptions.newest")}</option>
                <option value="createdAt">{t("adminAgentsPage.filters.sortOptions.oldest")}</option>
                <option value="firstName">{t("adminAgentsPage.filters.sortOptions.firstNameAsc")}</option>
                <option value="-firstName">{t("adminAgentsPage.filters.sortOptions.firstNameDesc")}</option>
                <option value="email">{t("adminAgentsPage.filters.sortOptions.emailAsc")}</option>
                <option value="-email">{t("adminAgentsPage.filters.sortOptions.emailDesc")}</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-text-muted">
              {t("adminAgentsPage.count", { count: filtered.length })}
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
              className="px-3 py-1.5 rounded-lg bg-surface-main/80 hover:bg-surface-main transition"
            >
              {t("adminAgentsPage.buttons.reset")}
            </button>
          </div>
        </div>

        {/* ================= FORMULAIRE ================= */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 bg-surface-main border border-border rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-sm"
          >
            {[
              { field: "firstName", label: t("adminAgentsPage.form.firstNameLabel"), type: "text" },
              { field: "lastName", label: t("adminAgentsPage.form.lastNameLabel"), type: "text" },
              { field: "email", label: t("adminAgentsPage.form.emailLabel"), type: "email" },
              {
                field: "password",
                label: t("adminAgentsPage.form.passwordLabel"),
                type: "password",
              },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className="text-xs font-medium text-text-secondary">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) =>
                    handleChange(field, e.target.value)
                  }
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
                />
                {errors[field] && (
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}

 {/* TAAAlAAAphone */}
            <div>
              <label className="text-xs font-medium text-text-secondary">
                {t("adminAgentsPage.form.phoneLabel")}
              </label>
              <input
                value={form.phone}
                onChange={(e) =>
                  handleChange("phone", e.target.value)
                }
                className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pays */}
            <div>
              <label className="text-xs font-medium text-text-secondary">
                {t("adminAgentsPage.form.countryLabel")}
              </label>
              <input
                value={form.country}
                maxLength={2}
                onChange={(e) =>
                  handleChange("country", e.target.value)
                }
                className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500"
              />
              {errors.country && (
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
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
                {loading
                  ? t("adminAgentsPage.buttons.creating")
                  : t("adminAgentsPage.buttons.createAgent")}
              </button>
            </div>
          </form>
        )}

        {/* ================= TABLEAU ================= */}
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          {t("adminAgentsPage.table.title")}
        </h2>

        {loadingAgents ? (
          <p className="text-center text-text-muted italic py-6">
            {t("adminAgentsPage.loadingAgents")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-muted italic py-6">
            {t("adminAgentsPage.table.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-main/80/60 text-text-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("adminAgentsPage.table.headers.name")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("adminAgentsPage.table.headers.email")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("adminAgentsPage.table.headers.phone")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("adminAgentsPage.table.headers.country")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("adminAgentsPage.table.headers.createdAt")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-surface-main border-b border-border/70 transition"
                  >
                    <td className="px-4 py-3">
                      {[a.firstName, a.lastName]
                        .filter(Boolean)
                        .join(" ") || t("adminAgentsPage.table.emptyValue")}
                    </td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3">
                      {a.phone || t("adminAgentsPage.table.emptyValue")}
                    </td>
                    <td className="px-4 py-3">
                      {a.country || t("adminAgentsPage.table.emptyValue")}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-2 text-xs text-text-muted">
              {t("adminAgentsPage.table.results", { count: filtered.length })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
  




