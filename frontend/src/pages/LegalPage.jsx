// ============================================================================
// LegalPage.jsx — Mentions légales • Teranga 2025
// ============================================================================

export default function LegalPage() {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 px-4 py-10">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-6 sm:p-10 border border-gray-200">

          <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
            Mentions légales
          </h1>

          <section className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              Conformément aux dispositions de la loi n°2004-575 du 21 juin 2004
              pour la confiance dans l’économie numérique (LCEN), il est précisé
              aux utilisateurs de l’application Teranga l’identité des différents
              intervenants dans le cadre de sa réalisation et de son suivi.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              1. Éditeur du site
            </h2>
            <p>
              <strong>Teranga Diaspora</strong><br />
              Service de gestion de biens, projets et services pour la diaspora
              africaine.<br />
              Siège social : Hamdallaye ACI 200, Bamako – Mali<br />
              Email : contact@teranga-platform.com
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              2. Responsabilité éditoriale
            </h2>
            <p>
              Le responsable de la publication est joignable à l’adresse :
              contact@teranga-platform.com
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              3. Hébergement
            </h2>
            <p>
              Application hébergée par : <strong>Netlify</strong><br />
              https://www.netlify.com
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              4. Propriété intellectuelle
            </h2>
            <p>
              L’application Teranga, son contenu, sa marque et son logo sont
              protégés par la législation en vigueur. Toute reproduction sans
              autorisation est interdite.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6">
              5. Contact
            </h2>
            <p>
              Pour toute question ou réclamation, vous pouvez nous écrire à :<br />
              <strong>contact@teranga-platform.com</strong>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
