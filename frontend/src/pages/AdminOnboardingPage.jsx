// ============================================================================
// AdminOnboardingPage.jsx
// Onboarding Pays → Régions → MASTER
// 🔒 ADMIN GLOBAL ONLY (redirection si MASTER)
// ZÉRO RÉGRESSION • BACKEND SOURCE OF TRUTH
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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

export default function AdminOnboardingPage() {
  const [step, setStep] = useState(1);

  // 🔐 Auth guard state
  const [isAllowed, setIsAllowed] = useState(null);

  // Étape 1 — Pays
  const [countryForm, setCountryForm] = useState({
    name: "",
    isoCode: "",
  });
  const [createdCountry, setCreatedCountry] = useState(null);

  // Étape 2 — Régions
  const [regionForm, setRegionForm] = useState({
    name: "",
    code: "",
  });
  const [regionsCreated, setRegionsCreated] = useState([]);

  // Étape 3 — MASTER
  const [masterForm, setMasterForm] = useState({
    email: "",
    password: "",
    scope: "country", // "country" | "region"
    regionId: "",
  });

  // ✅ Conserve GeoContext (cohérence globale)
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
  // 🔐 AUTH CHECK — ADMIN GLOBAL ONLY
  // - Autorisé : admin sans countryId/regionId
  // - Refusé  : agent/client + MASTER (admin scopé)
  // ========================================================================
  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const res = await me();
        if (!alive) return;

        const user = res?.user;
        const role = normalizeRole(user?.role);

        const isAdmin = role === "admin";
        const isMaster = Boolean(user?.countryId) || Boolean(user?.regionId);

        // ❌ Pas admin ou admin scopé (MASTER) -> redirect
        if (!isAdmin || isMaster) {
          window.location.href = "/dashboard";
          return;
        }

        // ✅ Admin global autorisé
        setIsAllowed(true);
      } catch (e) {
        console.error("❌ /me error:", e);
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
      console.error("❌ load countries:", e);
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
      console.error("❌ load regions:", e);
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
      alert("Nom et ISO2 (2 lettres) requis.");
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
      alert(err?.response?.data?.error || "Erreur mise à jour pays");
    }
  }

  async function handleDeleteCountry(country) {
    const confirmDelete = window.confirm(
      `Supprimer le pays "${country.name}" ? Cette action est définitive.`
    );
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
      alert(err?.response?.data?.error || "Erreur suppression pays");
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
      alert("Nom de région requis.");
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
      alert(err?.response?.data?.error || "Erreur mise à jour région");
    }
  }

  async function handleDeleteRegion(region) {
    const confirmDelete = window.confirm(
      `Supprimer la région "${region.name}" ? Cette action est définitive.`
    );
    if (!confirmDelete) return;

    try {
      await deleteRegion(region.id);
      setRegions((prev) => prev.filter((r) => r.id !== region.id));
      setRegionsCreated((prev) => prev.filter((r) => r.id !== region.id));
    } catch (err) {
      alert(err?.response?.data?.error || "Erreur suppression région");
    }
  }

  // ========================================================================
  // Étape 1 — Créer pays
  // ========================================================================
  async function createCountry(e) {
    e.preventDefault();
    if (!isCountryFormValid) {
      alert("Veuillez saisir un nom valide et un ISO2 (2 lettres).");
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

      // Reset régions/master quand on recrée un pays
      setRegionsCreated([]);
      setMasterForm((m) => ({
        ...m,
        scope: "country",
        regionId: "",
      }));
    } catch (err) {
      alert(err?.response?.data?.error || "Erreur création pays");
    } finally {
      setLoadingCountry(false);
    }
  }

  // ========================================================================
  // Étape 2 — Ajouter région
  // ========================================================================
  async function addRegion(e) {
    e.preventDefault();
    if (!isRegionFormValid) {
      alert("Veuillez saisir un nom et un code région valides.");
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
      alert(err?.response?.data?.error || "Erreur création région");
    } finally {
      setLoadingRegion(false);
    }
  }

  // ========================================================================
  // Étape 3 — Créer MASTER
  // ========================================================================
  async function createMaster(e) {
    e.preventDefault();
    if (!isMasterFormValid) {
      alert(
        masterForm.scope === "region"
          ? "Email + mot de passe (6+) + région requise."
          : "Email + mot de passe (6+) requis."
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

      // ✅ Backend existant: supporte countryId / regionId
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

      alert("✅ MASTER créé avec succès !");
      window.location.href = "/admin/users";
    } catch (err) {
      alert(err?.response?.data?.error || "Erreur création MASTER");
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
        <p className="text-gray-500 animate-pulse">Chargement…</p>
      </div>
    );
  }

  // ========================================================================
  // UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea] p-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8 border border-gray-200"
      >
        <h1 className="text-3xl font-semibold mb-2">🚀 Onboarding Pays & MASTER</h1>
        <p className="text-sm text-gray-500 mb-6">
          1) Crée un pays • 2) Ajoute des régions (optionnel) • 3) Crée le MASTER
          avec sélection guidée
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Gestion des pays & régions</h2>
              <p className="text-xs text-gray-500">
                Modifier, désactiver ou supprimer les pays et régions existants.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                loadCountries();
                loadRegions();
              }}
              className="px-3 py-1.5 rounded-full text-xs bg-white border border-gray-200 hover:border-gray-300"
            >
              {loadingCountries || loadingRegions ? "Actualisation…" : "Rafraîchir"}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-4">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Pays</h3>
                <span className="text-xs text-gray-400">
                  {loadingCountries ? "Chargement…" : `${countries.length} éléments`}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {countries.map((country) => {
                  const isEditing = editingCountryId === country.id;
                  return (
                    <div
                      key={country.id}
                      className="border border-gray-100 rounded-lg p-2"
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
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          />
                          <input
                            value={countryDraft.isoCode}
                            onChange={(e) =>
                              setCountryDraft((d) => ({
                                ...d,
                                isoCode: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          />
                          <label className="flex items-center gap-2 text-xs text-gray-600">
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
                            Actif
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveCountryEdit}
                              className="px-3 py-1.5 rounded-full text-xs bg-[#0a84ff] text-white"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCountryId(null)}
                              className="px-3 py-1.5 rounded-full text-xs bg-gray-100"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium">
                              {country.name} ({country.isoCode})
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {country.isActive ? "Actif" : "Inactif"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditCountry(country)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCountry(country)}
                              className="text-xs text-rose-600 hover:text-rose-800"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!countries.length && !loadingCountries && (
                  <p className="text-xs text-gray-400">Aucun pays enregistré.</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Régions</h3>
                <span className="text-xs text-gray-400">
                  {loadingRegions ? "Chargement…" : `${regions.length} éléments`}
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
                      className="border border-gray-100 rounded-lg p-2"
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
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          />
                          <input
                            value={regionDraft.code}
                            onChange={(e) =>
                              setRegionDraft((d) => ({
                                ...d,
                                code: e.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          />
                          <label className="flex items-center gap-2 text-xs text-gray-600">
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
                            Actif
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveRegionEdit}
                              className="px-3 py-1.5 rounded-full text-xs bg-[#0a84ff] text-white"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRegionId(null)}
                              className="px-3 py-1.5 rounded-full text-xs bg-gray-100"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium">
                              {region.name} {region.code ? `(${region.code})` : ""}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {country?.name
                                ? `${country.name} (${country.isoCode || "—"})`
                                : `Pays #${region.countryId || "—"}`}{" "}
                              • {region.isActive ? "Actif" : "Inactif"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditRegion(region)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRegion(region)}
                              className="text-xs text-rose-600 hover:text-rose-800"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!regions.length && !loadingRegions && (
                  <p className="text-xs text-gray-400">Aucune région enregistrée.</p>
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
                step >= s ? "bg-[#0a84ff]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={createCountry} className="space-y-4">
            <h2 className="text-xl font-medium">1️⃣ Créer un pays</h2>

            <input
              placeholder="Nom du pays"
              value={countryForm.name}
              onChange={(e) =>
                setCountryForm({ ...countryForm, name: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <input
              placeholder="Code ISO2 (ex: NE, ML)"
              value={countryForm.isoCode}
              onChange={(e) =>
                setCountryForm({ ...countryForm, isoCode: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <button
              disabled={!isCountryFormValid || loadingCountry}
              className={`px-6 py-2 rounded-full text-white text-sm font-medium transition ${
                !isCountryFormValid || loadingCountry
                  ? "bg-[#0a84ff]/40 cursor-not-allowed"
                  : "bg-[#0a84ff] hover:bg-[#0066cc]"
              }`}
            >
              {loadingCountry ? "Création…" : "Créer le pays →"}
            </button>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={addRegion} className="space-y-4">
            <h2 className="text-xl font-medium">
              2️⃣ Ajouter des régions (optionnel)
            </h2>

            <div className="text-sm text-gray-600">
              Pays créé :{" "}
              <span className="font-medium">
                {createdCountry?.name} ({createdCountry?.isoCode})
              </span>
            </div>

            {availableRegions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-2">Régions ajoutées</div>
                {availableRegions.map((r) => (
                  <div key={r.id} className="text-sm text-gray-700">
                    ✓ {r.name} {r.code ? `(${r.code})` : ""}
                  </div>
                ))}
              </div>
            )}

            <input
              placeholder="Nom de la région"
              value={regionForm.name}
              onChange={(e) =>
                setRegionForm({ ...regionForm, name: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <input
              placeholder="Code région (ex: BKO)"
              value={regionForm.code}
              onChange={(e) =>
                setRegionForm({ ...regionForm, code: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <div className="flex gap-3 flex-wrap">
              <button
                disabled={!isRegionFormValid || loadingRegion}
                className={`px-4 py-2 rounded-full text-sm transition ${
                  !isRegionFormValid || loadingRegion
                    ? "bg-gray-200/60 cursor-not-allowed text-gray-500"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {loadingRegion ? "Ajout…" : "➕ Ajouter région"}
              </button>

              <button
                type="button"
                disabled={!canGoStep3}
                onClick={() => setStep(3)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  !canGoStep3
                    ? "bg-[#0a84ff]/40 cursor-not-allowed text-white"
                    : "bg-[#0a84ff] text-white hover:bg-[#0066cc]"
                }`}
              >
                Continuer →
              </button>
            </div>
          </form>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <form onSubmit={createMaster} className="space-y-4">
            <h2 className="text-xl font-medium">3️⃣ Créer le compte MASTER</h2>

            <div className="text-sm text-gray-600">
              Pays cible :{" "}
              <span className="font-medium">
                {createdCountry?.name} ({createdCountry?.isoCode})
              </span>
            </div>

            <input
              placeholder="Email du master"
              type="email"
              value={masterForm.email}
              onChange={(e) =>
                setMasterForm({ ...masterForm, email: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            />

            <input
              placeholder="Mot de passe (min 6)"
              type="password"
              value={masterForm.password}
              onChange={(e) =>
                setMasterForm({ ...masterForm, password: e.target.value })
              }
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
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
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
            >
              <option value="country">MASTER du pays</option>
              <option value="region">MASTER d’une région</option>
            </select>

            {masterForm.scope === "region" && (
              <select
                value={masterForm.regionId}
                onChange={(e) =>
                  setMasterForm({ ...masterForm, regionId: e.target.value })
                }
                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0a84ff]"
              >
                <option value="">Choisir une région</option>
                {availableRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.code ? `(${r.code})` : ""}
                  </option>
                ))}
              </select>
            )}

            {masterForm.scope === "region" && availableRegions.length === 0 && (
              <div className="text-xs text-amber-600">
                ⚠️ Aucune région créée. Ajoute au moins une région à l’étape 2,
                ou repasse en “MASTER du pays”.
              </div>
            )}

            <button
              disabled={!isMasterFormValid || loadingMaster}
              className={`px-6 py-2 rounded-full text-white text-sm font-medium transition ${
                !isMasterFormValid || loadingMaster
                  ? "bg-[#0a84ff]/40 cursor-not-allowed"
                  : "bg-[#0a84ff] hover:bg-[#0066cc]"
              }`}
            >
              {loadingMaster ? "Création…" : "🎉 Créer le MASTER"}
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              ← Retour aux régions
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
