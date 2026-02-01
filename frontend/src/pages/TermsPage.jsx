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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
        <div className="page-shell max-w-4xl mx-auto p-6 sm:p-10">
          <p className="page-kicker mb-3">Cadre d'utilisation</p>
          <h1 className="page-title mb-6">
            Conditions générales d'utilisation
          </h1>

          <section className="space-y-4 text-slate-700 leading-relaxed">

            <p>
              Les présentes Conditions Générales d’Utilisation (CGU) encadrent
              l’accès et l’utilisation de l’application Teranga par ses membres.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              1. Objet
            </h2>
            <p>
              Teranga permet aux membres de la diaspora de suivre leurs biens,
              projets, services et transactions à distance en toute transparence.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              2. Utilisation de l’application
            </h2>
            <ul className="list-disc pl-6">
              <li>L'utilisateur s’engage à fournir des informations exactes.</li>
              <li>Il est responsable de la confidentialité de son compte.</li>
              <li>Tout usage frauduleux entraîne la suspension du compte.</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              3. Intervenants & responsabilités
            </h2>
            <p>
              Les agents effectuent les services sur la base des demandes des clients
              et rendent compte via l’application (preuves, documents, rapports).
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              4. Suspension / Suppression
            </h2>
            <p>
              Teranga peut suspendre un compte en cas d’abus, fraude ou violation
              des règles.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
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
