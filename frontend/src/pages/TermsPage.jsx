// ============================================================================
// TermsPage.jsx — Conditions générales d'utilisation • Teranga 2025
// ============================================================================
import SetSeo from "../components/SetSeo";

export default function TermsPage() {
  return (
    <>
      <SetSeo 
        title="Conditions d'utilisation"
        description="Découvrez les conditions d'utilisation de Teranga : règles, responsabilités et fonctionnement de la plateforme dédiée à la diaspora."
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 px-4 py-10">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-6 sm:p-10 border border-gray-200">

          <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
            Conditions générales d'utilisation
          </h1>

          <section className="space-y-4 text-gray-700 leading-relaxed">

            <p>
              Les présentes Conditions Générales d’Utilisation (CGU) encadrent
              l’accès et l’utilisation de l’application Teranga par ses membres,
              agents et administrateurs.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              1. Objet
            </h2>
            <p>
              Teranga permet aux membres de la diaspora de suivre leurs biens,
              projets, services et transactions à distance en toute transparence.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              2. Utilisation de l’application
            </h2>
            <ul className="list-disc pl-6">
              <li>L'utilisateur s’engage à fournir des informations exactes.</li>
              <li>Il est responsable de la confidentialité de son compte.</li>
              <li>Tout usage frauduleux entraîne la suspension du compte.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              3. Agents & responsabilités
            </h2>
            <p>
              Les agents effectuent les services sur la base des demandes des clients
              et rendent compte via l’application (preuves, documents, rapports).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              4. Suspension / Suppression
            </h2>
            <p>
              Teranga peut suspendre un compte en cas d’abus, fraude ou violation
              des règles.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              5. Contact
            </h2>
            <p>
              Toute question peut être adressée à : <br />
              <strong>contact@teranga-platform.com</strong>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
