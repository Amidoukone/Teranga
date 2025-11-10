import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Home,
  Truck,
  Globe,
  Mail,
  Phone,
  MapPin,
  HeartHandshake,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-800 scroll-smooth">
      {/* 🏠 HERO / ACCUEIL */}
      <section
        id="accueil"
        className="flex flex-col items-center justify-center text-center py-24 px-6 bg-gradient-to-b from-blue-100 to-white relative overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Bienvenue sur <span className="text-blue-600">Teranga 🌍</span>
          </h1>

          <p className="text-gray-700 text-lg sm:text-xl mb-10 leading-relaxed max-w-3xl mx-auto">
            <strong>Teranga</strong> est la plateforme de confiance qui relie la{" "}
            <strong>diaspora africaine</strong> à ses biens, projets et services
            sur le continent. Notre mission est de vous offrir une expérience
            fluide, transparente et sécurisée pour gérer vos investissements,
            vos démarches et vos propriétés à distance, en toute sérénité.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="px-7 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition flex items-center gap-2"
            >
              Se connecter <ArrowRight size={18} />
            </Link>
            <Link
              to="/register"
              className="px-7 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold shadow hover:bg-gray-300 transition"
            >
              Créer un compte
            </Link>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-gray-500 text-sm max-w-2xl mx-auto leading-relaxed"
        >
          🌍 <strong>Teranga</strong> rapproche les familles, les investisseurs
          et les services entre la diaspora et le continent africain — à
          commencer par le <strong>Mali</strong>, symbole de transparence et de
          confiance.
        </motion.p>
      </section>

      {/* ⚙️ SERVICES */}
      <section
        id="services"
        className="py-20 px-6 bg-white border-t border-gray-100"
      >
        <div className="max-w-6xl mx-auto text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Nos Services
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg leading-relaxed">
            Teranga vous offre une gamme complète de services conçus pour simplifier
            la gestion de vos biens, projets et démarches depuis l’étranger.
            Notre priorité : vous permettre de suivre, planifier et contrôler
            chaque action en toute transparence, où que vous soyez.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {[
            {
              icon: Home,
              title: 'Gestion immobilière',
              desc: 'Supervisez vos biens à distance grâce à une gestion complète : suivi d’entretien, rapports, visites virtuelles et gestion locative assurée par nos agents agréés.',
            },
            {
              icon: Truck,
              title: 'Services personnalisés',
              desc: 'Confiez-nous vos courses, paiements, démarches administratives ou chantiers : nos équipes locales fiables et réactives s’en occupent pour vous.',
            },
            {
              icon: Globe,
              title: 'Suivi et transparence',
              desc: 'Accédez à une interface moderne et claire pour suivre vos projets, transactions et dépenses en temps réel, avec des preuves et documents certifiés.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              whileHover={{ y: -5, scale: 1.03 }}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-10 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <Icon size={48} className="text-blue-600 mb-5" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {title}
              </h3>
              <p className="text-gray-600 text-base leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 💡 À PROPOS DE NOUS */}
      <section
        id="apropos"
        className="py-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100"
      >
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            À propos de nous
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Bien plus qu’une application, <strong>Teranga</strong> est un
            véritable pont de confiance entre la diaspora africaine et son
            patrimoine au pays.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-gray-700 text-base leading-relaxed space-y-6"
        >
          <p>
            Notre mission est de <strong>simplifier la vie des Africains de la
            diaspora</strong> en leur offrant des solutions fiables pour gérer
            leurs biens et leurs projets à distance, tout en garantissant une
            <strong> transparence totale</strong> à chaque étape.
          </p>
          <p>
            Implantée à <strong>Hamdallaye ACI 200, Bamako – Mali</strong>,
            notre équipe d’agents de terrain, d’ingénieurs et de partenaires
            certifiés veille à ce que chaque service soit exécuté avec rigueur,
            respect et efficacité.
          </p>
          <p>
            Nous croyons en un futur où la{" "}
            <strong>technologie crée la proximité</strong>, où chaque membre de
            la diaspora garde un lien solide et sûr avec ses projets au pays.
          </p>
        </motion.div>

        <div className="text-center mt-12">
          <Link
            to="/register"
            className="px-7 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition inline-flex items-center gap-2"
          >
            Rejoindre Teranga <HeartHandshake size={18} />
          </Link>
        </div>
      </section>

      {/* 📞 CONTACT */}
      <section
        id="contact"
        className="py-20 px-6 bg-white border-t border-gray-200"
      >
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Contactez-nous
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
            Vous faites partie de la diaspora et souhaitez collaborer avec une
            équipe sérieuse et réactive pour vos projets, biens ou démarches au
            Mali ? Écrivez-nous dès aujourd’hui : nous serons ravis de vous
            accompagner.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Formulaire */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('✅ Merci ! Votre message a bien été envoyé.');
            }}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm text-left"
          >
            {[{ label: 'Nom complet', type: 'text', placeholder: 'Votre nom' },
              { label: 'Adresse email', type: 'email', placeholder: 'exemple@email.com' }]
              .map((input, i) => (
                <div key={i} className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {input.label}
                  </label>
                  <input
                    type={input.type}
                    required
                    placeholder={input.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                required
                rows="4"
                placeholder="Votre message..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Envoyer le message
            </button>
          </form>

          {/* Infos de contact */}
          <div className="flex flex-col justify-center bg-white text-left space-y-5 p-4 md:p-0 text-gray-700">
            <div className="flex items-center gap-3">
              <Mail className="text-blue-600" />
              <p>contact@teranga-platform.com</p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="text-blue-600" />
              <p>+223 70 66 83 64 / +223 94 16 12 66</p>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="text-blue-600" />
              <p>Hamdallaye ACI 200, Bamako – Mali</p>
            </div>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Notre équipe vous répond sous 24 heures. Nous sommes disponibles
              pour vous assister dans toutes vos démarches, avec écoute et
              professionnalisme.
            </p>
          </div>
        </div>
      </section>

      {/* ⚓ FOOTER */}
      <footer className="bg-slate-900 text-gray-300 text-sm py-6 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <p>
            © {new Date().getFullYear()}{' '}
            <span className="text-cyan-400 font-semibold">Teranga</span> — Tous
            droits réservés.
          </p>
          <div className="flex gap-6">
            <a href="#accueil" className="hover:text-cyan-400 transition">
              Accueil
            </a>
            <a href="#services" className="hover:text-cyan-400 transition">
              Services
            </a>
            <a href="#apropos" className="hover:text-cyan-400 transition">
              À propos
            </a>
            <a href="#contact" className="hover:text-cyan-400 transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
