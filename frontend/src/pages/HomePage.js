// ============================================================================
// HomePage.jsx — Teranga Landing Page Premium 2025 (MOBILE FIRST)
// Version optimisée : alignements parfaits, typographies fluides, sections
// plus équilibrées & expériences responsive homogène.
// ============================================================================

import { Link } from "react-router-dom";
import {
  ArrowRight,
  Home,
  Truck,
  Globe,
  Mail,
  Phone,
  MapPin,
  HeartHandshake,
} from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-800 scroll-smooth">

      {/* ===================================================================== */}
      {/* 🏆 HERO SECTION — Modernisé + lisible mobile */}
      {/* ===================================================================== */}
      <section
        id="accueil"
        className="
          flex flex-col items-center justify-center text-center
          py-20 sm:py-28 px-5 relative overflow-hidden
        "
      >
        {/* Halo décoratif */}
        <div className="absolute -top-40 left-1/2 w-[850px] h-[850px] bg-blue-300/10 rounded-full blur-3xl -translate-x-1/2" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto relative"
        >
          <h1
            className="
              text-4xl sm:text-6xl font-extrabold text-gray-900
              mb-6 leading-snug sm:leading-[1.15] tracking-tight
            "
          >
            <span className="block text-blue-700">
              La confiance à distance,
            </span>
            <span className="block text-blue-700">
              la sérénité à portée de main.
            </span>
          </h1>

          <p
            className="
              text-gray-700 text-lg sm:text-xl leading-relaxed
              max-w-2xl mx-auto mb-10
            "
          >
            Avec <strong>Teranga</strong>, la diaspora africaine suit et gère ses
            biens, projets et démarches directement depuis l’étranger — avec
            transparence, fiabilité et une présence humaine sur le terrain.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-2">
            <Link
              to="/login"
              className="
                px-7 py-3 bg-blue-600 text-white rounded-lg font-semibold
                shadow hover:bg-blue-700 transition flex items-center gap-2
              "
            >
              Se connecter <ArrowRight size={18} />
            </Link>

            <Link
              to="/register"
              className="
                px-7 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold
                shadow hover:bg-gray-300 transition
              "
            >
              Créer un compte
            </Link>
          </div>
        </motion.div>

        <p
          className="
            mt-10 text-gray-500 text-sm max-w-xl mx-auto leading-relaxed
          "
        >
          Parce que la distance ne devrait jamais vous éloigner de ce qui compte.
        </p>
      </section>

      {/* ===================================================================== */}
      {/* ⚙️ SERVICES SECTION — Optimisée mobile */}
      {/* ===================================================================== */}
      <section
        id="services"
        className="py-20 px-5 bg-white border-t border-gray-100"
      >
        <div className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Nos services, votre tranquillité
          </h2>
          <p className="text-gray-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            Une gamme complète pensée pour simplifier la vie de la diaspora :
            suivi, preuves, transparence et support humain sur place.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {[
            {
              icon: Home,
              title: "Gestion immobilière",
              desc: "Suivi des biens, états des lieux, visites, rapports en images, gestion locative… Un agent dédié sur place.",
            },
            {
              icon: Truck,
              title: "Services personnalisés",
              desc: "Courses, démarches, paiements, chantiers, missions personnelles… Nous gérons pour vous, en toute fiabilité.",
            },
            {
              icon: Globe,
              title: "Transparence absolue",
              desc: "Photos, preuves, documents, transactions : accès instantané à toutes vos informations, où que vous soyez.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="
                bg-gray-50 border border-gray-200 rounded-2xl p-10
                shadow-sm hover:shadow-lg transition-all duration-300
                flex flex-col items-center text-center
              "
            >
              <Icon size={48} className="text-blue-600 mb-5" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {title}
              </h3>
              <p className="text-gray-600 text-base leading-relaxed">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 💡 À PROPOS — Storytelling optimisé + lisible */}
      {/* ===================================================================== */}
      <section
        id="apropos"
        className="py-20 px-5 bg-gradient-to-br from-blue-50 via-white to-blue-100"
      >
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Teranga : bien plus qu’un service
          </h2>
          <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Une plateforme pensée pour créer un lien de confiance solide entre la
            diaspora et ses projets au pays.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="
            max-w-3xl mx-auto text-gray-700 leading-relaxed text-[15px] sm:text-base
            space-y-6
          "
        >
          <p>
            Le mot <strong>“Teranga”</strong> évoque l’hospitalité, la chaleur
            humaine et le respect. Nous avons construit notre plateforme autour
            de ces valeurs.
          </p>
          <p>
            La distance crée souvent des doutes : “Mon bien est-il bien géré ?”,
            “Mon projet avance-t-il vraiment ?”. Nous apportons des réponses
            claires, visibles et traçables.
          </p>
          <p>
            Avec nos agents certifiés sur le terrain et une interface claire,
            vous gardez toujours le contrôle, où que vous viviez.
          </p>
        </motion.div>

        <div className="text-center mt-12">
          <Link
            to="/register"
            className="
              px-7 py-3 bg-blue-600 text-white rounded-lg font-semibold
              shadow hover:bg-blue-700 transition inline-flex items-center gap-2
            "
          >
            Rejoindre Teranga <HeartHandshake size={18} />
          </Link>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 📞 CONTACT — Mobile optimisé + meilleure lisibilité */}
      {/* ===================================================================== */}
      <section
        id="contact"
        className="py-20 px-5 bg-white border-t border-gray-200"
      >
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Contactez-nous
          </h2>
          <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Une question ? Une demande spécifique ? Notre équipe vous répond sous 24h.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* Formulaire contact */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Merci ! Votre message a bien été envoyé.");
            }}
            className="
              bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm
              flex flex-col gap-5
            "
          >
            {/* Nom + email */}
            {[
              { label: "Nom complet", type: "text", placeholder: "Votre nom" },
              { label: "Adresse email", type: "email", placeholder: "exemple@email.com" },
            ].map((input, i) => (
              <div key={i} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {input.label}
                </label>
                <input
                  type={input.type}
                  required
                  placeholder={input.placeholder}
                  className="
                    w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                    focus:ring-2 focus:ring-blue-500 outline-none
                  "
                />
              </div>
            ))}

            {/* Message */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Message</label>
              <textarea
                required
                rows={4}
                placeholder="Votre message..."
                className="
                  w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:ring-2 focus:ring-blue-500 outline-none resize-none
                "
              ></textarea>
            </div>

            <button
              type="submit"
              className="
                self-start px-6 py-2.5 bg-blue-600 text-white text-sm
                font-semibold rounded-lg hover:bg-blue-700 transition shadow
              "
            >
              Envoyer le message
            </button>
          </form>

          {/* Infos de contact */}
          <div className="flex flex-col justify-center space-y-6 text-gray-700">
            {[
              { icon: Mail, text: "contact@teranga-platform.com" },
              { icon: Phone, text: "+223 70 66 83 64 / +223 94 16 12 66" },
              { icon: MapPin, text: "Hamdallaye ACI 200, Bamako — Mali" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <Icon className="text-blue-600" />
                <p className="text-base">{text}</p>
              </div>
            ))}

            <p className="text-sm text-gray-500 leading-relaxed pt-2">
              Nous vous accompagnons avec écoute, respect et professionnalisme.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* ⚓ FOOTER — Alignement & lisibilité améliorée */}
      {/* ===================================================================== */}
      <footer className="bg-slate-900 text-gray-300 text-sm py-6 px-6 mt-10">
        <div
          className="
            max-w-6xl mx-auto flex flex-col sm:flex-row justify-between
            items-center gap-4 text-center sm:text-left
          "
        >
          <p>
            © {new Date().getFullYear()}{" "}
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
