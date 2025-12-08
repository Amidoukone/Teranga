// ============================================================================
// HomePage.jsx — Teranga Landing Page 2025
// Option A — Apple Light Premium v2 (Ultra-clean, cohérente avec NavBar A1-C)
// - Style : Apple Light minimal, typographie équilibrée, animations douces
// - 100% compatible avec ta structure (routes /login, /register, ancres, etc.)
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
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea] text-[#1c1c1e] scroll-smooth font-[system-ui]">
      <main className="flex-1">
        {/* ========================================================================= */}
        {/* 🏆 HERO — Apple Light (grands espaces / typographie premium)             */}
        {/* ========================================================================= */}
        <section
          id="accueil"
          className="
            flex flex-col items-center justify-center text-center
            pt-20 sm:pt-24 pb-16 sm:pb-24 px-6 relative overflow-hidden
          "
        >
          {/* Halo Apple */}
          <div className="absolute -top-56 left-1/2 w-[900px] h-[900px] bg-blue-300/10 rounded-full blur-[120px] -translate-x-1/2 pointer-events-none" />

          {/* Badge au-dessus du titre */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-5"
          >
            <span
              className="
                inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                bg-white/80 shadow-sm border border-gray-200 text-xs sm:text-sm
                text-gray-700
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0a84ff]" />
              Plateforme de confiance pour la diaspora africaine
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-4xl mx-auto relative"
          >
            <h1
              className="
                text-3xl sm:text-5xl md:text-6xl font-semibold text-[#111827]
                mb-6 leading-tight sm:leading-[1.15] tracking-tight
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
                text-gray-700 text-base sm:text-lg md:text-xl leading-relaxed
                max-w-2xl mx-auto mb-10 sm:mb-12
              "
            >
              Avec <strong>Teranga</strong>, la diaspora africaine suit et gère
              ses biens, projets et démarches depuis l’étranger —
              avec transparence, fiabilité et une présence humaine sur le
              terrain.
            </p>

            {/* CTA principal */}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              <Link
                to="/login"
                className="
                  px-7 py-3 bg-[#0a84ff] text-white rounded-full font-medium
                  shadow-sm hover:bg-[#0066cc] transition flex items-center gap-2
                  active:bg-[#004fa3] text-sm sm:text-base
                "
              >
                Se connecter <ArrowRight size={18} />
              </Link>

              <Link
                to="/register"
                className="
                  px-7 py-3 bg-[#e5e5ea] text-gray-800 rounded-full font-medium
                  shadow-sm hover:bg-[#d0d0d5] active:bg-[#bcbcc0] transition
                  text-sm sm:text-base
                "
              >
                Créer un compte
              </Link>
            </div>
          </motion.div>

          {/* Mini stats / bénéfices rapides */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="
              mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6
              max-w-3xl mx-auto text-gray-700 text-sm
            "
          >
            {[
              {
                label: "Suivi en temps réel",
                text: "Photos, preuves et rapports visibles à tout moment.",
              },
              {
                label: "Agents sur le terrain",
                text: "Des personnes de confiance, proches de vos projets.",
              },
              {
                label: "Pensé pour la diaspora",
                text: "Une interface claire, utilisable depuis l’étranger.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="
                  bg-white/80 border border-gray-200 rounded-2xl px-4 py-3
                  flex items-start gap-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]
                "
              >
                <CheckCircle2 className="mt-0.5 text-[#0a84ff]" size={18} />
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.text}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <p
            className="
              mt-8 sm:mt-10 text-gray-500 text-xs sm:text-sm max-w-xl mx-auto
              leading-relaxed tracking-wide
            "
          >
            Parce que la distance ne devrait jamais vous éloigner de ce qui
            compte.
          </p>
        </section>

        {/* ========================================================================= */}
        {/* ⚙️ SERVICES — Apple Cards + Animations + Shadow douce                   */}
        {/* ========================================================================= */}
        <section
          id="services"
          className="py-16 sm:py-20 px-6 bg-white border-t border-gray-200"
        >
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Nos services, votre tranquillité
            </h2>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              Des solutions conçues pour simplifier la vie de la diaspora tout
              en garantissant transparence et présence humaine sur place.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {[
              {
                icon: Home,
                title: "Gestion immobilière",
                desc: "Suivi des biens, visites, états des lieux, rapport en images, gestion locative… Un agent dédié sur place.",
              },
              {
                icon: Truck,
                title: "Services personnalisés",
                desc: "Courses, démarches, chantiers, missions personnelles… Nous gérons pour vous, en toute confiance.",
              },
              {
                icon: Globe,
                title: "Transparence absolue",
                desc: "Photos, preuves, documents, transactions : accès instantané à toutes vos informations, où que vous soyez.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
                className="
                  bg-gray-50 border border-[#e5e7eb] rounded-3xl p-8 sm:p-10
                  shadow-[0_4px_20px_rgba(0,0,0,0.05)]
                  hover:shadow-[0_10px_35px_rgba(15,23,42,0.08)]
                  transition-all flex flex-col items-center text-center
                "
              >
                <div
                  className="
                    w-14 h-14 rounded-2xl bg-[#0a84ff]/10 flex items-center justify-center
                    mb-5
                  "
                >
                  <Icon size={32} className="text-[#0a84ff]" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-3">
                  {title}
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 💡 POURQUOI TERANGA — 3 piliers (section courte & convaincante)         */}
        {/* ========================================================================= */}
        <section
          id="pourquoi"
          className="py-16 sm:py-20 px-6 bg-gradient-to-br from-[#f5f5f7] via-white to-[#e5e5ea]"
        >
          <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Pourquoi choisir Teranga ?
            </h2>
            <p className="text-gray-600 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              Parce qu’il ne s’agit pas seulement d’une application, mais d’un
              lien de confiance entre vous, vos proches et vos projets au pays.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-sm">
            {[
              {
                title: "Clarté",
                text: "Interface simple, lisible, pensée pour être utilisée sur mobile, même avec peu de temps.",
              },
              {
                title: "Crédibilité",
                text: "Suivi documenté, preuves visuelles, historique clair : vous gardez toujours la main.",
              },
              {
                title: "Accompagnement",
                text: "Une équipe à taille humaine, disponible et à l’écoute des réalités de la diaspora.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="
                  bg-white/80 border border-gray-200 rounded-2xl px-5 py-4
                  shadow-[0_4px_16px_rgba(15,23,42,0.04)]
                "
              >
                <h3 className="text-gray-900 font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 💡 À PROPOS — Apple Storytelling                                         */}
        {/* ========================================================================= */}
        <section
          id="apropos"
          className="py-16 sm:py-20 px-6 bg-white border-t border-gray-200"
        >
          <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Teranga : bien plus qu’un service
            </h2>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Une plateforme inspirée de la confiance et de l&apos;hospitalité,
              offrant un lien direct entre diaspora et projets au pays.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="
              max-w-3xl mx-auto text-gray-700 leading-relaxed
              text-[15px] sm:text-base space-y-5 sm:space-y-6
            "
          >
            <p>
              Le mot <strong>“Teranga”</strong> évoque chaleur humaine,
              confiance et respect. Notre plateforme reprend ces valeurs pour
              offrir une expérience moderne et rassurante.
            </p>
            <p>
              Vos projets méritent une visibilité totale : photos, preuves,
              rapports, transactions, progression… tout est accessible en temps
              réel, depuis n&apos;importe où.
            </p>
            <p>
              Grâce à nos agents certifiés et à une interface claire, vous
              gardez toujours le contrôle, sans devoir être physiquement sur
              place.
            </p>
          </motion.div>

          <div className="text-center mt-10 sm:mt-12">
            <Link
              to="/register"
              className="
                px-7 py-3 bg-[#0a84ff] text-white rounded-full font-medium
                shadow-sm hover:bg-[#0066cc] transition inline-flex items-center gap-2
                active:bg-[#004fa3] text-sm sm:text-base
              "
            >
              Rejoindre Teranga <HeartHandshake size={18} />
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 📞 CONTACT — Apple Form UI                                              */}
        {/* ========================================================================= */}
        <section
          id="contact"
          className="py-16 sm:py-20 px-6 bg-white border-t border-gray-200"
        >
          <div className="max-w-6xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Contactez-nous
            </h2>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Notre équipe vous répond avec attention sous 24h.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Formulaire */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Même comportement que ta version actuelle : simple alert côté client.
                alert("Merci ! Votre message a bien été envoyé.");
              }}
              className="
                bg-gray-50 border border-[#e5e7eb] rounded-3xl p-7 sm:p-8
                shadow-sm flex flex-col gap-5
              "
            >
              {[
                {
                  label: "Nom complet",
                  type: "text",
                  placeholder: "Votre nom",
                },
                {
                  label: "Adresse email",
                  type: "email",
                  placeholder: "email@example.com",
                },
              ].map((input) => (
                <div key={input.label} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {input.label}
                  </label>
                  <input
                    type={input.type}
                    required
                    placeholder={input.placeholder}
                    className="
                      w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                      focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] outline-none
                      bg-white
                    "
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Votre message..."
                  className="
                    w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                    focus:ring-2 focus:ring-[#0a84ff] focus:border-[#0a84ff] outline-none resize-none
                    bg-white
                  "
                />
              </div>

              <button
                type="submit"
                className="
                  self-start px-6 py-2.5 bg-[#0a84ff] text-white text-sm
                  font-medium rounded-full hover:bg-[#0066cc] transition shadow-sm
                  active:bg-[#004fa3]
                "
              >
                Envoyer le message
              </button>
            </form>

            {/* Infos de contact */}
            <div className="flex flex-col justify-center space-y-5 sm:space-y-6 text-gray-700">
              {[
                { icon: Mail, text: "contact@teranga-platform.com" },
                {
                  icon: Phone,
                  text: "+223 70 66 83 64 / +223 94 16 12 66",
                },
                {
                  icon: MapPin,
                  text: "Hamdallaye ACI 200, Bamako — Mali",
                },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0a84ff]/10 flex items-center justify-center">
                    <Icon className="text-[#0a84ff]" size={18} />
                  </div>
                  <p className="text-sm sm:text-base">{text}</p>
                </div>
              ))}

              <p className="text-sm text-gray-500 leading-relaxed pt-2">
                Nous vous accompagnons avec écoute, respect et
                professionnalisme, pour que chaque échange soit simple et
                rassurant.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ⚓ FOOTER — Apple Minimal                                                 */}
      {/* ========================================================================= */}
      <footer className="bg-[#1c1c1e] text-gray-300 text-xs sm:text-sm py-6 px-6 mt-4">
        <div
          className="
            max-w-6xl mx-auto flex flex-col sm:flex-row justify-between
            items-center gap-4 text-center sm:text-left
          "
        >
          <p>
            © {currentYear}{" "}
            <span className="text-[#0a84ff] font-medium">Teranga</span> — Tous
            droits réservés.
          </p>

          <div className="flex gap-5 sm:gap-6">
            <a
              href="#accueil"
              className="hover:text-[#0a84ff] transition-colors"
            >
              Accueil
            </a>
            <a
              href="#services"
              className="hover:text-[#0a84ff] transition-colors"
            >
              Services
            </a>
            <a
              href="#apropos"
              className="hover:text-[#0a84ff] transition-colors"
            >
              À propos
            </a>
            <a
              href="#contact"
              className="hover:text-[#0a84ff] transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
