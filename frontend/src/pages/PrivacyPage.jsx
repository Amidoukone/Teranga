// ============================================================================
// PrivacyPage.jsx — Politique de confidentialité RGPD • Teranga 2025
// ============================================================================
import SetTitle from "../components/SetTitleWrapper";

export default function PrivacyPage() {
  return (
    <>
      <SetTitle title="Politique de confidentialité" />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 px-4 py-10">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-6 sm:p-10 border border-gray-200">

          <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
            Politique de confidentialité (RGPD)
          </h1>

          <section className="space-y-4 text-gray-700 leading-relaxed">

            <p>
              La présente politique explique comment Teranga collecte, utilise,
              stocke et protège vos données personnelles conformément au RGPD
              (Règlement Général sur la Protection des Données — UE) et aux bonnes
              pratiques de protection de la vie privée.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              1. Données collectées
            </h2>
            <ul className="list-disc pl-6">
              <li>Données d’identification : nom, prénom, email</li>
              <li>Données de connexion : token, adresse IP, appareil</li>
              <li>Données liées aux services : biens, projets, transactions</li>
              <li>Preuves envoyées : photos, vidéos, documents</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              2. Finalités du traitement
            </h2>
            <p>Les données sont utilisées pour :</p>
            <ul className="list-disc pl-6">
              <li>Gérer votre compte et votre authentification</li>
              <li>Exécuter les services demandés</li>
              <li>Assurer la sécurité de l’application</li>
              <li>Suivre les projets, biens et transactions</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              3. Conservation des données
            </h2>
            <p>
              Les données sont conservées aussi longtemps que nécessaire à
              l’exécution des services ou conformément aux obligations légales.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              4. Partage des données
            </h2>
            <p>
              Teranga ne revend pas vos données. Elles peuvent être transmises à
              des agents certifiés uniquement pour l’exécution des services.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              5. Vos droits (RGPD)
            </h2>
            <ul className="list-disc pl-6">
              <li>Droit d’accès</li>
              <li>Droit de rectification</li>
              <li>Droit à la suppression</li>
              <li>Droit d’opposition</li>
              <li>Droit à la portabilité</li>
            </ul>

            <p>
              Pour exercer vos droits : <br />
              <strong>contact@teranga-platform.com</strong>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
