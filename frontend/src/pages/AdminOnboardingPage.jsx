// ============================================================================
// AdminOnboardingPage.jsx
// Onboarding Pays ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ RÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©gions ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ MASTER
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ADMIN GLOBAL ONLY (redirection si MASTER)
// ZÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°RO RÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°GRESSION ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ BACKEND SOURCE OF TRUTH
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { createUser } from "../services/users";
import { me } from "../services/auth";
import { normalizeRole } from "../utils/role";
import { useGeo } from "../contexts/GeoContext";
import {
  getCountries,
  updateCountry,
  deleteCountry,
} from "../services/countries";
import { getRegions, updateRegion, deleteRegion } from "../services/regions";
import { notify } from '../utils/notify';
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import {
  AdminActionsRow,
  AdminPanelCard,
  AdminRowActions,
  AdminStepForm,
} from "../components/admin/AdminFormUi";

export default function AdminOnboardingPage() {
  const { t } = useTranslation();
  const { confirmDeleteNamed } = useDeleteConfirm();
  const [step, setStep] = useState(1);

  // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Auth guard state
  const [isAllowed, setIsAllowed] = useState(null);

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 1 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â Pays
  const [countryForm, setCountryForm] = useState({
    name: "",
    isoCode: "",
  });
  const [createdCountry, setCreatedCountry] = useState(null);

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 2 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â RÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©gions
  const [regionForm, setRegionForm] = useState({
    name: "",
    code: "",
  });
  const [regionsCreated, setRegionsCreated] = useState([]);

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 3 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â MASTER
  const [masterForm, setMasterForm] = useState({
    email: "",
    password: "",
    scope: "country", // "country" | "region"
    regionId: "",
  });

  // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Conserve GeoContext (cohÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rence globale)
  useGeo();

  // Loading flags
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);

  // Admin listing + edit/delete
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editingRegionId, setEditingRegionId] = useState(null);
  const [countryDraft, setCountryDraft] = useState({
    name: "",
    isoCode: "",
    isActive: true,
  });
  const [regionDraft, setRegionDraft] = useState({
    name: "",
    code: "",
    isActive: true,
  });

  // ========================================================================
  // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â AUTH CHECK ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ADMIN GLOBAL ONLY
  // - AutorisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© : admin sans countryId/regionId
  // - RefusÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©  : agent/client + MASTER (admin scopÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©)
  // ========================================================================
  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const res = await me();
        if (!alive) return;

        const user = res?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }
        const role = normalizeRole(user?.role);

        const isAdmin = role === "admin";
        const isMaster = Boolean(user?.countryId) || Boolean(user?.regionId);

        // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Pas admin ou admin scopÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© (MASTER) -> redirect
        if (!isAdmin || isMaster) {
          window.location.href = "/dashboard";
          return;
        }

        // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Admin global autorisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©
        setIsAllowed(true);
      } catch (e) {
        console.error("/me error:", e);
        window.location.href = "/login";
      }
    }

    check();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isAllowed) return;
    loadCountries();
    loadRegions();
  }, [isAllowed]);

  // ========================================================================
  // Derived / Guards
  // ========================================================================
  const canGoStep3 = Boolean(createdCountry?.id);
  const availableRegions = useMemo(() => regionsCreated, [regionsCreated]);

  const isCountryFormValid = useMemo(() => {
    const name = countryForm.name.trim();
    const iso = countryForm.isoCode.trim().toUpperCase();
    return name.length >= 2 && iso.length === 2;
  }, [countryForm]);

  const isRegionFormValid = useMemo(() => {
    if (!createdCountry?.id) return false;
    const name = regionForm.name.trim();
    const code = regionForm.code.trim().toUpperCase();
    return name.length >= 2 && code.length >= 2;
  }, [regionForm, createdCountry]);

  const isMasterFormValid = useMemo(() => {
    if (!createdCountry?.id) return false;

    const email = masterForm.email.trim();
    const pwd = masterForm.password;

    if (!email.includes("@")) return false;
    if (!pwd || pwd.length < 6) return false;

    if (masterForm.scope === "region") {
      return Boolean(masterForm.regionId);
    }

    return true;
  }, [masterForm, createdCountry]);

  const countryLookup = useMemo(() => {
    const map = new Map();
    countries.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [countries]);

  async function loadCountries() {
    setLoadingCountries(true);
    try {
      const list = await getCountries({ includeInactive: true });
      setCountries(list);
    } catch (e) {
      console.error("load countries:", e);
    } finally {
      setLoadingCountries(false);
    }
  }

  async function loadRegions() {
    setLoadingRegions(true);
    try {
      const list = await getRegions({
        includeInactive: true,
        includeCountry: true,
      });
      setRegions(list);
    } catch (e) {
      console.error("load regions:", e);
    } finally {
      setLoadingRegions(false);
    }
  }

  function startEditCountry(country) {
    setEditingCountryId(country.id);
    setCountryDraft({
      name: country.name || "",
      isoCode: country.isoCode || "",
      isActive: Boolean(country.isActive),
    });
  }

  async function saveCountryEdit() {
    if (!editingCountryId) return;
    const trimmedName = countryDraft.name.trim();
    const trimmedIso = countryDraft.isoCode.trim().toUpperCase();

    if (trimmedName.length < 2 || trimmedIso.length !== 2) {
      notify(t("adminOnboardingPage.errors.countryEditValidation"));
      return;
    }

    try {
      await updateCountry(editingCountryId, {
        name: trimmedName,
        isoCode: trimmedIso,
        isActive: countryDraft.isActive,
      });
      setEditingCountryId(null);
      await loadCountries();
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.countryEdit"));
    }
  }

  async function handleDeleteCountry(country) {
    const confirmDelete = await confirmDeleteNamed("country", country.name);
    if (!confirmDelete) return;

    try {
      await deleteCountry(country.id);
      if (createdCountry?.id === country.id) {
        setCreatedCountry(null);
        setStep(1);
      }
      await loadCountries();
      await loadRegions();
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.countryDelete"));
    }
  }

  function startEditRegion(region) {
    setEditingRegionId(region.id);
    setRegionDraft({
      name: region.name || "",
      code: region.code || "",
      isActive: Boolean(region.isActive),
    });
  }

  async function saveRegionEdit() {
    if (!editingRegionId) return;
    const trimmedName = regionDraft.name.trim();
    const trimmedCode = regionDraft.code.trim().toUpperCase();

    if (trimmedName.length < 2) {
      notify(t("adminOnboardingPage.errors.regionEditValidation"));
      return;
    }

    try {
      await updateRegion(editingRegionId, {
        name: trimmedName,
        code: trimmedCode || null,
        isActive: regionDraft.isActive,
      });
      setEditingRegionId(null);
      await loadRegions();
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.regionEdit"));
    }
  }

  async function handleDeleteRegion(region) {
    const confirmDelete = await confirmDeleteNamed("region", region.name);
    if (!confirmDelete) return;

    try {
      await deleteRegion(region.id);
      setRegions((prev) => prev.filter((r) => r.id !== region.id));
      setRegionsCreated((prev) => prev.filter((r) => r.id !== region.id));
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.regionDelete"));
    }
  }

  // ========================================================================
  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 1 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â CrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©er pays
  // ========================================================================
  async function createCountry(e) {
    e.preventDefault();
    if (!isCountryFormValid) {
      notify(t("adminOnboardingPage.errors.countryCreateValidation"));
      return;
    }

    setLoadingCountry(true);
    try {
      const payload = {
        name: countryForm.name.trim(),
        isoCode: countryForm.isoCode.trim().toUpperCase(),
      };

      const { data } = await api.post("/countries", payload);

      setCreatedCountry(data.country);
      setStep(2);
      await loadCountries();

      // Reset rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©gions/master quand on recrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e un pays
      setRegionsCreated([]);
      setMasterForm((m) => ({
        ...m,
        scope: "country",
        regionId: "",
      }));
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.countryCreate"));
    } finally {
      setLoadingCountry(false);
    }
  }

  // ========================================================================
  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 2 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â Ajouter rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©gion
  // ========================================================================
  async function addRegion(e) {
    e.preventDefault();
    if (!isRegionFormValid) {
      notify(t("adminOnboardingPage.errors.regionCreateValidation"));
      return;
    }

    setLoadingRegion(true);
    try {
      const payload = {
        name: regionForm.name.trim(),
        code: regionForm.code.trim().toUpperCase(),
        countryId: createdCountry.id,
      };

      const { data } = await api.post("/regions", payload);

      setRegionsCreated((r) => [...r, data.region]);
      setRegionForm({ name: "", code: "" });
      await loadRegions();
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.regionCreate"));
    } finally {
      setLoadingRegion(false);
    }
  }

  // ========================================================================
  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°tape 3 ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â CrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©er MASTER
  // ========================================================================
  async function createMaster(e) {
    e.preventDefault();
    if (!isMasterFormValid) {
      notify(
        masterForm.scope === "region"
          ? t("adminOnboardingPage.errors.masterValidationRegion")
          : t("adminOnboardingPage.errors.masterValidationCountry")
      );
      return;
    }

    setLoadingMaster(true);
    try {
      const payload = {
        email: masterForm.email.trim(),
        password: masterForm.password,
        role: "admin",
      };

      // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Backend existant: supporte countryId / regionId
      if (masterForm.scope === "region") {
        const rid = Number(masterForm.regionId);
        payload.regionId = rid;

        const region =
          availableRegions.find((r) => String(r.id) === String(rid)) ||
          regions.find((r) => String(r.id) === String(rid));
        const regionCountryId = region?.countryId ?? createdCountry?.id ?? null;

        if (regionCountryId) {
          payload.countryId = Number(regionCountryId);
        }
      } else {
        payload.countryId = createdCountry.id;
      }

      await createUser(payload);

      notify(t("adminOnboardingPage.success.masterCreated"));
      window.location.href = "/admin/users";
    } catch (err) {
      notify(err?.response?.data?.error || t("adminOnboardingPage.errors.masterCreate"));
    } finally {
      setLoadingMaster(false);
    }
  }

  // ========================================================================
  // LOADING GUARD
  // ========================================================================
  if (isAllowed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-muted animate-pulse">
          {t("adminOnboardingPage.loading.page")}
        </p>
      </div>
    );
  }

  // ========================================================================
  // UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main p-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-surface-card rounded-3xl shadow-xl p-8 border border-border"
      >
        <h1 className="text-3xl font-semibold mb-2">
          {t("adminOnboardingPage.title")}
        </h1>
        <p className="text-sm text-text-muted mb-6">
          {t("adminOnboardingPage.subtitle")}
        </p>

        <div className="bg-surface-main border border-border rounded-2xl p-4 mb-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">
                {t("adminOnboardingPage.management.title")}
              </h2>
              <p className="text-xs text-text-muted">
                {t("adminOnboardingPage.management.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                loadCountries();
                loadRegions();
              }}
              className="px-3 py-1.5 rounded-full text-xs bg-surface-card border border-border hover:border-border"
            >
              {loadingCountries || loadingRegions
                ? t("adminOnboardingPage.loading.refresh")
                : t("adminOnboardingPage.buttons.refresh")}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-4">
            <div className="bg-surface-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">
                  {t("adminOnboardingPage.lists.countries")}
                </h3>
                <span className="text-xs text-text-muted">
                  {loadingCountries
                    ? t("adminOnboardingPage.loading.countries")
                    : t("adminOnboardingPage.counts.items", {
                        count: countries.length,
                      })}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {countries.map((country) => {
                  const isEditing = editingCountryId === country.id;
                  return (
                    <div
                      key={country.id}
                      className="border border-border/70 rounded-lg p-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={countryDraft.name}
                            onChange={(e) =>
                              setCountryDraft((d) => ({
                                ...d,
                                name: e.target.value,
                              }))
                            }
                            className="app-input-compact w-full p-2"
                          />
                          <input
                            value={countryDraft.isoCode}
                            onChange={(e) =>
                              setCountryDraft((d) => ({
                                ...d,
                                isoCode: e.target.value,
                              }))
                            }
                            className="w-full border border-border rounded-lg p-2 text-xs bg-surface-card text-text-primary"
                          />
                          <label className="flex items-center gap-2 text-xs text-text-secondary">
                            <input
                              type="checkbox"
                              checked={countryDraft.isActive}
                              onChange={(e) =>
                                setCountryDraft((d) => ({
                                  ...d,
                                  isActive: e.target.checked,
                                }))
                              }
                            />
                            {t("adminOnboardingPage.status.active")}
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveCountryEdit}
                              className="app-btn-primary px-3 py-1.5 rounded-full text-xs"
                            >
                              {t("adminOnboardingPage.buttons.save")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCountryId(null)}
                              className="px-3 py-1.5 rounded-full text-xs bg-surface-main/80"
                            >
                              {t("adminOnboardingPage.buttons.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium">
                              {country.name} ({country.isoCode})
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {country.isActive
                                ? t("adminOnboardingPage.status.active")
                                : t("adminOnboardingPage.status.inactive")}
                            </div>
                          </div>
                          <AdminRowActions
                            actions={[
                              {
                                key: "edit-country",
                                label: t("adminOnboardingPage.buttons.edit"),
                                onClick: () => startEditCountry(country),
                                buttonClassName: "app-link-primary text-xs",
                              },
                              {
                                key: "delete-country",
                                label: t("adminOnboardingPage.buttons.delete"),
                                onClick: () => handleDeleteCountry(country),
                                buttonClassName: "app-link-danger text-xs",
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!countries.length && !loadingCountries && (
                  <p className="text-xs text-text-muted">
                    {t("adminOnboardingPage.empty.countries")}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-surface-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">
                  {t("adminOnboardingPage.lists.regions")}
                </h3>
                <span className="text-xs text-text-muted">
                  {loadingRegions
                    ? t("adminOnboardingPage.loading.regions")
                    : t("adminOnboardingPage.counts.items", {
                        count: regions.length,
                      })}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {regions.map((region) => {
                  const isEditing = editingRegionId === region.id;
                  const country =
                    region.country || countryLookup.get(String(region.countryId));
                  return (
                    <div
                      key={region.id}
                      className="border border-border/70 rounded-lg p-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={regionDraft.name}
                            onChange={(e) =>
                              setRegionDraft((d) => ({
                                ...d,
                                name: e.target.value,
                              }))
                            }
                            className="app-input-compact w-full p-2"
                          />
                          <input
                            value={regionDraft.code}
                            onChange={(e) =>
                              setRegionDraft((d) => ({
                                ...d,
                                code: e.target.value,
                              }))
                            }
                            className="app-input-compact w-full p-2"
                          />
                          <label className="flex items-center gap-2 text-xs text-text-secondary">
                            <input
                              type="checkbox"
                              checked={regionDraft.isActive}
                              onChange={(e) =>
                                setRegionDraft((d) => ({
                                  ...d,
                                  isActive: e.target.checked,
                                }))
                              }
                            />
                            {t("adminOnboardingPage.status.active")}
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveRegionEdit}
                              className="app-btn-primary px-3 py-1.5 rounded-full text-xs"
                            >
                              {t("adminOnboardingPage.buttons.save")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRegionId(null)}
                              className="px-3 py-1.5 rounded-full text-xs bg-surface-main/80"
                            >
                              {t("adminOnboardingPage.buttons.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium">
                              {region.name} {region.code ? `(${region.code})` : ""}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {country?.name
                                ? `${country.name} (${country.isoCode || "-"})`
                                : t("adminOnboardingPage.labels.countryFallback", {
                                    id: region.countryId || "-",
                                  })}{" "}
                              {" - "}
                              {region.isActive
                                ? t("adminOnboardingPage.status.active")
                                : t("adminOnboardingPage.status.inactive")}
                            </div>
                          </div>
                          <AdminRowActions
                            actions={[
                              {
                                key: "edit-region",
                                label: t("adminOnboardingPage.buttons.edit"),
                                onClick: () => startEditRegion(region),
                                buttonClassName: "app-link-primary text-xs",
                              },
                              {
                                key: "delete-region",
                                label: t("adminOnboardingPage.buttons.delete"),
                                onClick: () => handleDeleteRegion(region),
                                buttonClassName: "app-link-danger text-xs",
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!regions.length && !loadingRegions && (
                  <p className="text-xs text-text-muted">
                    {t("adminOnboardingPage.empty.regions")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP INDICATOR */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                step >= s ? "bg-blue-600" : "bg-surface-main/80"
              }`}
            />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <AdminStepForm
            onSubmit={createCountry}
            title={t("adminOnboardingPage.steps.step1")}
          >

            <input
              placeholder={t("adminOnboardingPage.placeholders.countryName")}
              value={countryForm.name}
              onChange={(e) =>
                setCountryForm({ ...countryForm, name: e.target.value })
              }
              className="app-input"
            />

            <input
              placeholder={t("adminOnboardingPage.placeholders.iso2")}
              value={countryForm.isoCode}
              onChange={(e) =>
                setCountryForm({ ...countryForm, isoCode: e.target.value })
              }
              className="app-input"
            />

            <button
              disabled={!isCountryFormValid || loadingCountry}
              className="app-btn-primary px-6 py-2 rounded-full text-sm font-medium"
            >
              {loadingCountry
                ? t("adminOnboardingPage.loading.creatingCountry")
                : t("adminOnboardingPage.buttons.createCountry")}
            </button>
          </AdminStepForm>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <AdminStepForm
            onSubmit={addRegion}
            title={t("adminOnboardingPage.steps.step2")}
          >

            <div className="text-sm text-text-secondary">
              {t("adminOnboardingPage.labels.countryCreated")}{" "}
              <span className="font-medium">
                {createdCountry?.name} ({createdCountry?.isoCode})
              </span>
            </div>

            {availableRegions.length > 0 && (
              <AdminPanelCard className="bg-surface-main p-3">
                <div className="text-xs text-text-muted mb-2">
                  {t("adminOnboardingPage.lists.addedRegions")}
                </div>
                {availableRegions.map((r) => (
                  <div key={r.id} className="text-sm text-text-secondary">
                    {r.name} {r.code ? `(${r.code})` : ""}
                  </div>
                ))}
              </AdminPanelCard>
            )}

            <input
              placeholder={t("adminOnboardingPage.placeholders.regionName")}
              value={regionForm.name}
              onChange={(e) =>
                setRegionForm({ ...regionForm, name: e.target.value })
              }
              className="app-input"
            />

            <input
              placeholder={t("adminOnboardingPage.placeholders.regionCode")}
              value={regionForm.code}
              onChange={(e) =>
                setRegionForm({ ...regionForm, code: e.target.value })
              }
              className="app-input"
            />

            <AdminActionsRow className="gap-3">
              <button
                disabled={!isRegionFormValid || loadingRegion}
                className={`px-4 py-2 rounded-full text-sm transition ${
                  !isRegionFormValid || loadingRegion ? "app-btn-disabled" : "app-btn-soft"
                }`}
              >
                {loadingRegion
                  ? t("adminOnboardingPage.loading.addingRegion")
                  : t("adminOnboardingPage.buttons.addRegion")}
              </button>

              <button
                type="button"
                disabled={!canGoStep3}
                onClick={() => setStep(3)}
                className="app-btn-primary px-4 py-2 rounded-full text-sm font-medium"
              >
                {t("adminOnboardingPage.buttons.continue")}
              </button>
            </AdminActionsRow>
          </AdminStepForm>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <AdminStepForm
            onSubmit={createMaster}
            title={t("adminOnboardingPage.steps.step3")}
          >

            <div className="text-sm text-text-secondary">
              {t("adminOnboardingPage.labels.targetCountry")}{" "}
              <span className="font-medium">
                {createdCountry?.name} ({createdCountry?.isoCode})
              </span>
            </div>

            <input
              placeholder={t("adminOnboardingPage.placeholders.masterEmail")}
              type="email"
              value={masterForm.email}
              onChange={(e) =>
                setMasterForm({ ...masterForm, email: e.target.value })
              }
              className="app-input"
            />

            <input
              placeholder={t("adminOnboardingPage.placeholders.masterPassword")}
              type="password"
              value={masterForm.password}
              onChange={(e) =>
                setMasterForm({ ...masterForm, password: e.target.value })
              }
              className="app-input"
            />

            <select
              value={masterForm.scope}
              onChange={(e) =>
                setMasterForm({
                  ...masterForm,
                  scope: e.target.value,
                  regionId: "",
                })
              }
              className="app-input"
            >
              <option value="country">
                {t("adminOnboardingPage.options.masterCountry")}
              </option>
              <option value="region">
                {t("adminOnboardingPage.options.masterRegion")}
              </option>
            </select>

            {masterForm.scope === "region" && (
              <select
                value={masterForm.regionId}
                onChange={(e) =>
                  setMasterForm({ ...masterForm, regionId: e.target.value })
                }
                className="app-input"
              >
                <option value="">
                  {t("adminOnboardingPage.options.selectRegion")}
                </option>
                {availableRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.code ? `(${r.code})` : ""}
                  </option>
                ))}
              </select>
            )}

            {masterForm.scope === "region" && availableRegions.length === 0 && (
              <div className="app-badge app-badge-warning text-xs">
                {t("adminOnboardingPage.hints.noRegionsForMaster")}
              </div>
            )}

            <button
              disabled={!isMasterFormValid || loadingMaster}
              className="app-btn-primary px-6 py-2 rounded-full text-sm font-medium"
            >
              {loadingMaster
                ? t("adminOnboardingPage.loading.creatingMaster")
                : t("adminOnboardingPage.buttons.createMaster")}
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-text-muted hover:text-text-primary underline"
            >
              {t("adminOnboardingPage.buttons.backToRegions")}
            </button>
          </AdminStepForm>
        )}
      </motion.div>
    </div>
  );
}



