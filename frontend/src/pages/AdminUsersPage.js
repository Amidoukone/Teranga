// ============================================================================
// AdminUsersPage.jsx ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Apple Light Premium B2 Minimal
// Version 2025 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ADMIN GLOBAL & MASTER (admin + geo scope)
// BACKEND SOURCE OF TRUTH ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ZERO REGRESSION
//
// ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ SÃƒÆ’Ã‚Â©curitÃƒÆ’Ã‚Â© ajoutÃƒÆ’Ã‚Â©e (2026):
// - Un MASTER ne peut PAS crÃƒÆ’Ã‚Â©er ni promouvoir un admin
// - Seul l'ADMIN GLOBAL peut crÃƒÆ’Ã‚Â©er admin / master
// - Double verrou UI + payload (anti-DOM hack)
// - Un MASTER ne peut pas ÃƒÆ’Ã‚Â©diter/supprimer un admin existant (UI + guard)
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  manualPasswordReset,
  getManualPasswordResetAudit,
} from "../services/users";
import { getRegions } from "../services/regions";
import { me } from "../services/auth";
import { motion } from "framer-motion";
import { normalizeRole, isMasterUser, prettyRoleLabel } from "../utils/role";
import { useGeo } from "../contexts/GeoContext";
import { useTranslation } from "react-i18next";
import { notify } from '../utils/notify';
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import {
  AdminActionsRow,
  AdminField,
  AdminFilterBar,
  AdminFormPanel,
  AdminPageHeader,
  AdminRowActions,
} from "../components/admin/AdminFormUi";

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
function extractApiError(err, fallbackMessage) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallbackMessage
  );
}

function formatDateTime(value, locale = "fr-FR") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale);
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
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

  const [formRegions, setFormRegions] = useState([]);
  const [loadingFormRegions, setLoadingFormRegions] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    country: "",
    role: "client",

    // Legacy (prÃƒÆ’Ã‚Â©sent, mais non utilisÃƒÆ’Ã‚Â© par dÃƒÆ’Ã‚Â©faut)
    scopeCountry: "",
    scopeRegion: "",

    // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ SÃƒÆ’Ã‚Â©lection guidÃƒÆ’Ã‚Â©e (IDs) pour admins (GLOBAL uniquement)
    scopeCountryId: "",
    scopeRegionId: "",
  });

  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
    reason: "",
  });
  const [resetLoading, setResetLoading] = useState(false);
  const [resetAudit, setResetAudit] = useState([]);
  const [resetAuditLoading, setResetAuditLoading] = useState(false);

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
  // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â AUTH CHECK
  // ============================================================
  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await me();
        if (!active) return;

        const user = res?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }
        if (normalizeRole(user.role) !== "admin") {
          window.location.href = "/dashboard";
          return;
        }

        setCurrentUser(user);
        setIsAdmin(true);
      } catch (e) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ /me error:", e);
        window.location.href = "/login";
      }
    }

    check();
    return () => {
      active = false;
    };
  }, []);

  // ============================================================
  // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ LOAD USERS
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(role, {
        adminType: role === "admin" && isGlobalAdmin ? filters.adminType : undefined,
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Load users error:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters.adminType, isGlobalAdmin, role]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // ============================================================
  // ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¾ Persist form visibility
  // ============================================================
  useEffect(() => {
    localStorage.setItem("teranga_admin_users_showForm", showForm ? "1" : "0");
  }, [showForm]);

  // ============================================================
  // ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â Regions filtrÃƒÆ’Ã‚Â©es par le pays sÃƒÆ’Ã‚Â©lectionnÃƒÆ’Ã‚Â© (form)
  // ============================================================
  useEffect(() => {
    let active = true;

    async function loadFormRegions() {
      const cid = toSafeIntOrEmpty(form.scopeCountryId);
      const isAdminTarget = normalizeRole(form.role) === "admin";

      if (!cid || !isGlobalAdmin || !isAdminTarget) {
        if (active) setFormRegions([]);
        return;
      }

      setLoadingFormRegions(true);
      try {
        const list = await getRegions({
          countryId: Number(cid),
          includeInactive: true,
        });
        if (active) setFormRegions(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ load form regions:", err);
        if (active) setFormRegions([]);
      } finally {
        if (active) setLoadingFormRegions(false);
      }
    }

    loadFormRegions();
    return () => {
      active = false;
    };
  }, [form.scopeCountryId, form.role, isGlobalAdmin]);

  // ============================================================
  // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â½ FILTERING (local) + tri
  // ============================================================
  useEffect(() => {
    let arr = [...users];

    // Filtre GeoContext (si prÃƒÆ’Ã‚Â©sent)
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
  // ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â  PAYLOAD BUILDER ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â DOUBLE VERROU (UI + anti-DOM hack)
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

    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ ROLE SECURITY (anti hack DOM)
    const targetRole = normalizeRole(form.role);

    // MASTER => interdit admin
    if (isMaster && targetRole === "admin") {
      const err = new Error(t("adminUsersPage.alerts.masterCannotPromote"));
      err.status = 403;
      throw err;
    }

    payload.role = targetRole;

    // CrÃƒÆ’Ã‚Â©ation : password requis
    if (!editing && !toSafeStr(form.password).trim()) {
      const err = new Error(t("adminUsersPage.alerts.passwordRequired"));
      err.status = 400;
      throw err;
    }

    // Update : password optionnel
    if (toSafeStr(form.password).trim()) {
      payload.password = toSafeStr(form.password);
    }

    // Scope admin (IDs only) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â seulement GLOBAL admin
    if (targetRole === "admin" && !isMaster) {
      const cid = toSafeIntOrEmpty(form.scopeCountryId);
      const rid = toSafeIntOrEmpty(form.scopeRegionId);

      if (rid) {
        payload.regionId = Number(rid);
        if (cid) payload.countryId = Number(cid);
      } else if (cid) {
        payload.countryId = Number(cid);
      }
      // vide = admin global
    }

    return payload;
  }

  // ============================================================
  // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ SUBMIT
  // ============================================================
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = buildPayload();

      if (editing) {
        await updateUser(editing, payload);
        notify(t("adminUsersPage.alerts.updated"));
      } else {
        await createUser(payload);
        notify(t("adminUsersPage.alerts.created"));
      }

      resetForm();
      await load();
    } catch (err) {
      notify(extractApiError(err, t("adminUsersPage.alerts.submitError")));
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Submit error:", err);
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
    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ MASTER ne peut pas ÃƒÆ’Ã‚Â©diter un admin existant
    if (isMaster && normalizeRole(u.role) === "admin") {
      notify(t("adminUsersPage.alerts.masterCannotEdit"));
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
    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ MASTER ne peut pas supprimer un admin
    if (isMaster && normalizeRole(u.role) === "admin") {
      notify(t("adminUsersPage.alerts.masterCannotDelete"));
      return;
    }
    const ok = await confirmDelete("user");
    if (!ok) return;

    try {
      await deleteUser(u.id);
      notify(t("adminUsersPage.alerts.deleted"));
      await load();
    } catch (err) {
      notify(extractApiError(err, t("adminUsersPage.alerts.submitError")));
      console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Delete error:", err);
    }
  }

  async function openResetPanel(u) {
    if (isMaster && normalizeRole(u.role) === "admin") {
      notify(t("adminUsersPage.alerts.masterCannotResetAdmin"));
      return;
    }

    setResetTarget(u);
    setResetPasswordForm({
      newPassword: "",
      confirmPassword: "",
      reason: "",
    });
    setResetAudit([]);
    setResetAuditLoading(true);

    try {
      const items = await getManualPasswordResetAudit(u.id, 20);
      setResetAudit(Array.isArray(items) ? items : []);
    } catch (err) {
      notify(extractApiError(err, t("adminUsersPage.alerts.resetAuditError")));
      setResetAudit([]);
    } finally {
      setResetAuditLoading(false);
    }
  }

  function closeResetPanel() {
    setResetTarget(null);
    setResetLoading(false);
    setResetAuditLoading(false);
    setResetAudit([]);
    setResetPasswordForm({
      newPassword: "",
      confirmPassword: "",
      reason: "",
    });
  }

  async function submitManualReset(e) {
    e.preventDefault();
    if (!resetTarget) return;

    const newPassword = String(resetPasswordForm.newPassword || "");
    const confirmPassword = String(resetPasswordForm.confirmPassword || "");

    if (newPassword.length < 8) {
      notify(t("adminUsersPage.alerts.resetPasswordMin"));
      return;
    }

    if (newPassword !== confirmPassword) {
      notify(t("adminUsersPage.alerts.resetPasswordMismatch"));
      return;
    }

    setResetLoading(true);
    try {
      await manualPasswordReset(resetTarget.id, {
        newPassword,
        reason: String(resetPasswordForm.reason || "").trim() || null,
        invalidateSessions: true,
      });

      notify(t("adminUsersPage.alerts.resetSuccess"));

      const items = await getManualPasswordResetAudit(resetTarget.id, 20);
      setResetAudit(Array.isArray(items) ? items : []);
      setResetPasswordForm((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (err) {
      notify(extractApiError(err, t("adminUsersPage.alerts.submitError")));
    } finally {
      setResetLoading(false);
    }
  }

  // ============================================================
  // ÃƒÂ¢Ã‚ÂÃ‚Â³ LOADING GUARD
  // ============================================================
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-muted animate-pulse">{t("adminUsersPage.loading")}</p>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-10 font-[system-ui] text-text-primary">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto bg-surface-card shadow-xl rounded-3xl p-8 border border-border"
      >
        {/* HEADER */}
        <AdminPageHeader
          className="items-center"
          title={t("adminUsersPage.title")}
          titleClassName="text-3xl"
          meta={
            currentUser && (
              <div className="mt-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full border border-border bg-surface-main text-text-secondary">
                    {prettyRoleLabel(currentUser)}
                  </span>

                  {normalizeRole(currentUser?.role) === "admin" && (
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs ${
                        isMaster
                          ? "app-badge app-badge-info"
                          : "app-badge app-badge-success"
                      }`}
                      title={
                        isMaster
                          ? t("adminUsersPage.badges.masterTitle")
                          : t("adminUsersPage.badges.globalTitle")
                      }
                    >
                      {isMaster
                        ? t("adminUsersPage.badges.master")
                        : t("adminUsersPage.badges.global")}
                    </span>
                  )}

                  {isMaster && (
                    <span className="text-text-muted">
                      {t("adminUsersPage.labels.perimeter")}
                      {currentUser?.countryId != null
                        ? ` ${t("adminUsersPage.labels.countryId", {
                            id: currentUser.countryId,
                          })}`
                        : ""}
                      {currentUser?.regionId != null
                        ? ` Â· ${t("adminUsersPage.labels.regionId", {
                            id: currentUser.regionId,
                          })}`
                        : ""}
                    </span>
                  )}

                  {!isMaster && (
                    <span className="text-text-muted">
                      {t("adminUsersPage.labels.globalAccess")}
                    </span>
                  )}

                  {geoCountryId && !isScopedRole && (
                    <span className="text-text-muted">
                      {t("adminUsersPage.labels.filter")}{" "}
                      {geoCountry?.name ||
                        t("adminUsersPage.labels.countryId", { id: geoCountryId })}
                      {geoRegionId
                        ? ` Â· ${
                            geoRegion?.name ||
                            t("adminUsersPage.labels.regionId", { id: geoRegionId })
                          }`
                        : ""}
                      {canSelect ? ` ${t("adminUsersPage.labels.selection")}` : ""}
                    </span>
                  )}
                </span>
              </div>
            )
          }
          actionsClassName="gap-3"
          actions={
            <>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-5 py-2 rounded-full app-btn-neutral text-sm font-medium shadow transition"
              >
                {showForm
                  ? t("adminUsersPage.buttons.hideForm")
                  : t("adminUsersPage.buttons.showForm")}
              </button>

              <button
                onClick={load}
                disabled={loading}
                className="app-btn-primary px-5 py-2 rounded-full text-sm font-medium shadow"
              >
                {loading ? t("adminUsersPage.loading") : t("adminUsersPage.buttons.refresh")}
              </button>
            </>
          }
        />

        {/* FILTER BAR */}

        <AdminFilterBar className="mb-6 rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* RÃƒÆ’Ã‚Â´le */}
            <AdminField label={t("adminUsersPage.filters.category")}>
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setRole(nextRole);
                  if (nextRole !== "admin") {
                    setFilters((prev) => ({ ...prev, adminType: "all" }));
                  }
                }}
                className="mt-1 app-input"
              >
                <option value="client">{t("adminUsersPage.filters.roles.clients")}</option>
                <option value="agent">{t("adminUsersPage.filters.roles.agents")}</option>
                <option value="admin">{t("adminUsersPage.filters.roles.admins")}</option>
              </select>
            </AdminField>

            {/* Type d'admin (GLOBAL uniquement) */}
            {role === "admin" && isGlobalAdmin && (
              <AdminField label={t("adminUsersPage.filters.adminType")}>
                <select
                  value={filters.adminType}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      adminType: e.target.value,
                    })
                  }
                  className="mt-1 app-input"
                >
                  <option value="all">{t("adminUsersPage.filters.adminTypes.all")}</option>
                  <option value="master">{t("adminUsersPage.filters.adminTypes.master")}</option>
                  <option value="global">{t("adminUsersPage.filters.adminTypes.global")}</option>
                </select>
              </AdminField>
            )}

            {/* Recherche */}
            <AdminField label={t("adminUsersPage.filters.search")} className="lg:col-span-2">
              <input
                placeholder={t("adminUsersPage.placeholders.search")}
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="mt-1 app-input"
              />
            </AdminField>

            {/* Pays */}
            <AdminField label={t("adminUsersPage.filters.country")}>
              <input
                placeholder={t("adminUsersPage.placeholders.country")}
                value={filters.country}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                className="mt-1 app-input"
              />
            </AdminField>

            {/* Checkbox */}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={filters.onlyPhone}
                  onChange={(e) => setFilters({ ...filters, onlyPhone: e.target.checked })}
                />
                {t("adminUsersPage.filters.withPhone")}
              </label>
            </div>

            {/* Tri */}
            <AdminField label={t("adminUsersPage.filters.sort")}>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="mt-1 app-input"
              >
                <option value="-createdAt">{t("adminUsersPage.filters.sortOptions.newest")}</option>
                <option value="createdAt">{t("adminUsersPage.filters.sortOptions.oldest")}</option>
                <option value="firstName">{t("adminUsersPage.filters.sortOptions.firstNameAsc")}</option>
                <option value="-firstName">{t("adminUsersPage.filters.sortOptions.firstNameDesc")}</option>
                <option value="email">{t("adminUsersPage.filters.sortOptions.emailAsc")}</option>
                <option value="-email">{t("adminUsersPage.filters.sortOptions.emailDesc")}</option>
              </select>
            </AdminField>
          </div>

          <div className="mt-3 flex justify-between text-xs text-text-muted">
            <span>{t("adminUsersPage.countUsers", { count: filtered.length })}</span>
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
              className="app-btn-soft px-3 py-1.5 rounded-md"
            >
              {t("adminUsersPage.buttons.reset")}
            </button>
          </div>
        </AdminFilterBar>

        {/* FORMULAIRE */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <AdminFormPanel onSubmit={handleSubmit} className="md:grid-cols-2 bg-surface-main/80">
              {[
                ["firstName", t("adminUsersPage.placeholders.firstName")],
                ["lastName", t("adminUsersPage.placeholders.lastName")],
                ["phone", t("adminUsersPage.placeholders.phone")],
                ["country", t("adminUsersPage.placeholders.countryIso")],
              ].map(([key, label]) => (
                <AdminField key={key} label={label}>
                  <input
                    placeholder={label}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="app-input"
                  />
                </AdminField>
              ))}

              <AdminField label={t("adminUsersPage.placeholders.email")} className="md:col-span-2">
                <input
                  placeholder={t("adminUsersPage.placeholders.email")}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="app-input"
                />
              </AdminField>

              <AdminField
                label={t("adminUsersPage.placeholders.password")}
                className="md:col-span-2"
              >
                <input
                  placeholder={t("adminUsersPage.placeholders.password")}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="app-input"
                />
              </AdminField>

              {/* ROLE SELECT MASTER: client/agent only */}
              <AdminField label={t("adminUsersPage.table.headers.role")} className="md:col-span-2">
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
                  className="app-input"
                >
                  <option value="client">{t("adminUsersPage.roles.client")}</option>
                  <option value="agent">{t("adminUsersPage.roles.agent")}</option>
                  {isGlobalAdmin && <option value="admin">{t("adminUsersPage.roles.admin")}</option>}
                </select>
              </AdminField>

              {normalizeRole(form.role) === "client" && (
                <div className="md:col-span-2 app-alert app-alert-info rounded-xl px-3 py-2 text-xs">
                  {t("adminUsersPage.info.clientScope")}
                </div>
              )}

              {/* ADMIN: guided country/region scope (IDs) - GLOBAL only */}
              {isGlobalAdmin && normalizeRole(form.role) === "admin" && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AdminField label={t("adminUsersPage.info.countryScopeLabel")}>
                    <select
                      value={form.scopeCountryId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          scopeCountryId: e.target.value,
                          scopeRegionId: "",
                        })
                      }
                      className="app-input"
                    >
                      <option value="">{t("adminUsersPage.info.globalScopeOption")}</option>
                      {(countries || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.isoCode})
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField label={t("adminUsersPage.info.regionScopeLabel")}>
                    <select
                      value={form.scopeRegionId}
                      disabled={
                        !form.scopeCountryId || loadingFormRegions || formRegions.length === 0
                      }
                      onChange={(e) => setForm({ ...form, scopeRegionId: e.target.value })}
                      className={`app-input ${
                        !form.scopeCountryId || loadingFormRegions || formRegions.length === 0
                          ? "bg-surface-main/80 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <option value="">
                        {!form.scopeCountryId
                          ? t("adminUsersPage.info.chooseCountryFirst")
                          : loadingFormRegions
                            ? t("adminUsersPage.info.regionsLoading")
                            : t("adminUsersPage.info.masterCountryOption")}
                      </option>
                      {formRegions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.code ? `(${r.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <p className="md:col-span-2 text-xs text-text-muted">
                    {t("adminUsersPage.info.masterHint")}
                  </p>
                </div>
              )}

              <AdminActionsRow className="md:col-span-2 justify-end mt-2">
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-full app-btn-soft text-sm"
                  >
                    {t("adminUsersPage.buttons.cancel")}
                  </button>
                )}

                <button
                  type="submit"
                  className="px-6 py-2 rounded-full app-btn-primary text-sm font-medium"
                >
                  {editing
                    ? t("adminUsersPage.buttons.update")
                    : t("adminUsersPage.buttons.create")}
                </button>
              </AdminActionsRow>
            </AdminFormPanel>
          </motion.div>
        )}

        {/* TABLE */}
        {loading ? (
          <p className="text-center text-text-muted py-6">{t("adminUsersPage.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-muted py-6">{t("adminUsersPage.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="bg-surface-main/80 text-text-secondary">
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.name")}
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.email")}
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.phone")}
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.country")}
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.role")}
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    {t("adminUsersPage.table.headers.actions")}
                  </th>
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
                      className="bg-surface-card hover:bg-surface-main transition border border-border rounded-xl"
                    >
                      <td className="px-4 py-2">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                          t("adminUsersPage.table.emptyValue")}
                      </td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">
                        {u.phone || t("adminUsersPage.table.emptyValue")}
                      </td>
                      <td className="px-4 py-2">
                        {u.country || t("adminUsersPage.table.emptyValue")}
                      </td>
                      <td className="px-4 py-2 uppercase">{prettyRoleLabel(u)}</td>

                      <td className="px-4 py-2">
                        <AdminRowActions
                          className="gap-3"
                          actions={[
                            {
                              key: "edit",
                              label: t("adminUsersPage.table.edit"),
                              onClick: () => handleEdit(u),
                              disabled: actionsLocked,
                              title: actionsLocked
                                ? t("adminUsersPage.table.lockedTitle")
                                : t("adminUsersPage.table.edit"),
                              buttonClassName: actionsLocked
                                ? "text-text-muted cursor-not-allowed"
                                : "app-link-warning",
                            },
                            {
                              key: "reset",
                              label: t("adminUsersPage.table.resetPassword"),
                              onClick: () => openResetPanel(u),
                              disabled: actionsLocked,
                              title: actionsLocked
                                ? t("adminUsersPage.table.lockedTitle")
                                : t("adminUsersPage.table.resetPassword"),
                              buttonClassName: actionsLocked
                                ? "text-text-muted cursor-not-allowed"
                                : "app-link-primary",
                            },
                            {
                              key: "delete",
                              label: t("adminUsersPage.table.delete"),
                              onClick: () => handleDelete(u),
                              disabled: actionsLocked,
                              title: actionsLocked
                                ? t("adminUsersPage.table.lockedTitle")
                                : t("adminUsersPage.table.delete"),
                              buttonClassName: actionsLocked
                                ? "text-text-muted cursor-not-allowed"
                                : "app-link-danger",
                            },
                          ]}
                        />

                        {actionsLocked && (
                          <span className="text-[11px] text-text-muted">
                            {t("adminUsersPage.table.protected")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-xs text-text-muted mt-4">
              {t("adminUsersPage.table.results", { count: filtered.length })}
            </p>
          </div>
        )}

        {resetTarget && (
          <div className="mt-8 rounded-2xl app-alert app-alert-info p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {t("adminUsersPage.resetPanel.title")}{" "}
                <span className="text-sm font-normal text-text-secondary">
                  ({resetTarget.email})
                </span>
              </h2>
              <button
                type="button"
                onClick={closeResetPanel}
                className="px-3 py-1.5 rounded-full app-btn-soft text-sm"
              >
                {t("adminUsersPage.resetPanel.close")}
              </button>
            </div>

            <AdminFormPanel onSubmit={submitManualReset} className="md:grid-cols-2 gap-3 bg-transparent border-0 shadow-none p-0">
              <AdminField label={t("adminUsersPage.resetPanel.newPassword")}>
                <input
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) =>
                    setResetPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder={t("adminUsersPage.resetPanel.newPassword")}
                  className="app-input"
                  minLength={8}
                  required
                />
              </AdminField>
              <AdminField label={t("adminUsersPage.resetPanel.confirmPassword")}>
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) =>
                    setResetPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  placeholder={t("adminUsersPage.resetPanel.confirmPassword")}
                  className="app-input"
                  minLength={8}
                  required
                />
              </AdminField>
              <AdminField label={t("adminUsersPage.resetPanel.reason")} className="md:col-span-2">
                <input
                  type="text"
                  value={resetPasswordForm.reason}
                  onChange={(e) =>
                    setResetPasswordForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder={t("adminUsersPage.resetPanel.reason")}
                  className="app-input"
                />
              </AdminField>
              <AdminActionsRow className="md:col-span-2 justify-end">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="app-btn-primary px-5 py-2 rounded-full text-sm font-medium text-white"
                >
                  {resetLoading
                    ? t("adminUsersPage.resetPanel.submitting")
                    : t("adminUsersPage.resetPanel.submit")}
                </button>
              </AdminActionsRow>
            </AdminFormPanel>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                {t("adminUsersPage.resetPanel.auditTitle")}
              </h3>

              {resetAuditLoading ? (
                <p className="text-xs text-text-muted">{t("adminUsersPage.loading")}</p>
              ) : resetAudit.length === 0 ? (
                <p className="text-xs text-text-muted">
                  {t("adminUsersPage.resetPanel.auditEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {resetAudit.map((item) => {
                    const actorLabel =
                      [item?.actor?.firstName, item?.actor?.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || item?.actor?.email || "admin";
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-surface-card px-3 py-2"
                      >
                        <p className="text-xs text-text-secondary">
                          <strong>{formatDateTime(item.createdAt)}</strong> · {actorLabel}
                        </p>
                        {item?.metadata?.reason ? (
                          <p className="text-xs text-text-secondary mt-1">
                            {t("adminUsersPage.resetPanel.reasonLabel")} {item.metadata.reason}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-text-muted mt-1">
                          {t("adminUsersPage.resetPanel.revokedSessions", {
                            count: Number(item?.metadata?.revokedSessions || 0),
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}






