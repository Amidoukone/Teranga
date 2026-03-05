// ============================================================================
// HomePage.jsx Teranga Landing Page 2025
// Option A - Apple Light Premium v2 (Ultra-clean, coherente avec NavBar A1-C)
// - Style : Apple Light minimal, typographie equilibree, animations douces
// - 100% compatible avec ta structure (routes /login, /register, ancres, etc.)
// ============================================================================

import { Link } from "react-router-dom";
import {
  ArrowRight,
  Home,
  Truck,
  Globe,
  ClipboardList,
  Wrench,
  FolderKanban,
  Mail,
  Phone,
  MapPin,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import { notify } from '../utils/notify';

export default function HomePage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const heroStats = [
    {
      label: t("homePage.hero.stats.realTime.label"),
      text: t("homePage.hero.stats.realTime.text"),
    },
    {
      label: t("homePage.hero.stats.agents.label"),
      text: t("homePage.hero.stats.agents.text"),
    },
    {
      label: t("homePage.hero.stats.diaspora.label"),
      text: t("homePage.hero.stats.diaspora.text"),
    },
  ];
  const serviceCards = [
    {
      icon: Home,
      title: t("homePage.services.cards.realEstate.title"),
      desc: t("homePage.services.cards.realEstate.desc"),
    },
    {
      icon: Truck,
      title: t("homePage.services.cards.personal.title"),
      desc: t("homePage.services.cards.personal.desc"),
    },
    {
      icon: Globe,
      title: t("homePage.services.cards.transparency.title"),
      desc: t("homePage.services.cards.transparency.desc"),
    },
  ];
  const pillars = [
    {
      title: t("homePage.why.pillars.clarity.title"),
      text: t("homePage.why.pillars.clarity.text"),
    },
    {
      title: t("homePage.why.pillars.credibility.title"),
      text: t("homePage.why.pillars.credibility.text"),
    },
    {
      title: t("homePage.why.pillars.support.title"),
      text: t("homePage.why.pillars.support.text"),
    },
  ];
  const useCaseCards = [
    {
      icon: Wrench,
      title: t("homePage.useCases.cards.service.title"),
      desc: t("homePage.useCases.cards.service.desc"),
    },
    {
      icon: ClipboardList,
      title: t("homePage.useCases.cards.task.title"),
      desc: t("homePage.useCases.cards.task.desc"),
    },
    {
      icon: FolderKanban,
      title: t("homePage.useCases.cards.project.title"),
      desc: t("homePage.useCases.cards.project.desc"),
    },
  ];
  const impactPoints = [
    t("homePage.impact.points.p1"),
    t("homePage.impact.points.p2"),
    t("homePage.impact.points.p3"),
  ];
  const contactFields = [
    {
      label: t("homePage.contact.form.name.label"),
      type: "text",
      placeholder: t("homePage.contact.form.name.placeholder"),
    },
    {
      label: t("homePage.contact.form.email.label"),
      type: "email",
      placeholder: t("homePage.contact.form.email.placeholder"),
    },
  ];
  const contactInfos = [
    { icon: Mail, text: t("homePage.contact.info.email") },
    { icon: Phone, text: t("homePage.contact.info.phone") },
    { icon: MapPin, text: t("homePage.contact.info.address") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface-main via-surface-card to-surface-main text-text-primary scroll-smooth">
      <main className="flex-1">
        {/* ========================================================================= */}
 {/* HERO - Apple Light (grands espaces / typographie premium) */}
        {/* ========================================================================= */}
        <section
          id="accueil"
          className="
            flex flex-col items-center justify-center text-center
            pt-20 sm:pt-24 pb-16 sm:pb-24 px-6 relative overflow-hidden
          "
        >
          {/* Halo premium */}
          <div className="absolute -top-40 left-1/2 w-[860px] h-[860px] bg-blue-400/15 dark:bg-cyan-400/10 rounded-full blur-[140px] -translate-x-1/2 pointer-events-none" />

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
                bg-surface-card/80 shadow-sm border border-border text-xs sm:text-sm
                text-text-secondary
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              {t("homePage.hero.badge")}
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
                text-3xl sm:text-5xl md:text-6xl font-semibold text-text-primary
                mb-6 leading-tight sm:leading-[1.15] tracking-tight
              "
            >
              <span className="block text-blue-700 dark:text-blue-300">
                {t("homePage.hero.titleLine1")}
              </span>
              <span className="block text-blue-700 dark:text-blue-300">
                {t("homePage.hero.titleLine2")}
              </span>
            </h1>

            <p
              className="
                text-text-secondary text-base sm:text-lg md:text-xl leading-relaxed
                max-w-2xl mx-auto mb-10 sm:mb-12
              "
            >
              <Trans
                i18nKey="homePage.hero.description"
                components={[<strong key="hero-strong" />]}
              />
            </p>

            {/* CTA principal */}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              <Link
                to="/login"
                className="btn-primary rounded-full px-7 py-3 text-sm sm:text-base flex items-center gap-2"
              >
                {t("homePage.hero.ctaLogin")} <ArrowRight size={18} />
              </Link>

              <Link
                to="/register"
                className="btn-secondary rounded-full px-7 py-3 text-sm sm:text-base"
              >
                {t("homePage.hero.ctaRegister")}
              </Link>
            </div>
          </motion.div>

 {/* Mini stats / bAAnAAfices rapides */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="
              mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6
              max-w-3xl mx-auto text-text-secondary text-sm
            "
          >
            {heroStats.map((item) => (
              <div
                key={item.label}
                className="
                  bg-surface-card/80 border border-border rounded-2xl px-4 py-3
                  flex items-start gap-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]
                "
              >
                <CheckCircle2 className="mt-0.5 text-blue-600" size={18} />
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {item.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{item.text}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <p
            className="
              mt-8 sm:mt-10 text-text-muted text-xs sm:text-sm max-w-xl mx-auto
              leading-relaxed tracking-wide
            "
          >
            {t("homePage.hero.tagline")}
          </p>
        </section>

        {/* ========================================================================= */}
 {/* POUR QUI / CAS D'USAGE */}
        {/* ========================================================================= */}
        <section
          id="usage"
          className="py-16 sm:py-20 px-6 bg-surface-main border-t border-border/70"
        >
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              {t("homePage.useCases.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              {t("homePage.useCases.subtitle")}
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {useCaseCards.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
                className="
                  bg-surface-card border border-border/70 rounded-3xl p-7 sm:p-8
                  shadow-[0_10px_30px_rgba(15,23,42,0.06)]
                  transition-all
                "
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-4">
                  <Icon size={24} className="text-blue-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-text-primary mb-2">
                  {title}
                </h3>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
 {/* SERVICES - Apple Cards + Animations + Shadow douce */}
        {/* ========================================================================= */}
        <section
          id="services"
          className="py-16 sm:py-20 px-6 bg-surface-card border-t border-border/70"
        >
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              {t("homePage.services.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              {t("homePage.services.subtitle")}
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {serviceCards.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
                className="
                  bg-surface-main border border-border/70 rounded-3xl p-8 sm:p-10
                  shadow-[0_10px_30px_rgba(15,23,42,0.08)]
                  hover:shadow-[0_10px_35px_rgba(15,23,42,0.08)]
                  transition-all flex flex-col items-center text-center
                "
              >
                <div
                  className="
                    w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center
                    mb-5
                  "
                >
                  <Icon size={32} className="text-blue-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-text-primary mb-3">
                  {title}
                </h3>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
 {/* POURQUOI TERANGA - 3 piliers (section courte et convaincante) */}
        {/* ========================================================================= */}
        <section
          id="pourquoi"
          className="py-16 sm:py-20 px-6 bg-gradient-to-br from-surface-main via-surface-card to-surface-main"
        >
          <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              {t("homePage.why.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              {t("homePage.why.subtitle")}
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-sm">
            {pillars.map((item) => (
              <div
                key={item.title}
                className="
                  bg-surface-card/80 border border-border rounded-2xl px-5 py-4
                  shadow-[0_4px_16px_rgba(15,23,42,0.06)]
                "
              >
                <h3 className="text-text-primary font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
 {/* IMPACT */}
        {/* ========================================================================= */}
        <section
          className="py-16 sm:py-20 px-6 bg-surface-main border-t border-border/70"
        >
          <div className="max-w-4xl mx-auto rounded-3xl border border-blue-500/25 bg-blue-500/10 p-7 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-3">
              {t("homePage.impact.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-6">
              {t("homePage.impact.subtitle")}
            </p>

            <div className="grid gap-3">
              {impactPoints.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-blue-600" size={18} />
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    {point}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <Link
                to="/help-support"
                className="btn-secondary rounded-full px-6 py-2.5 text-sm sm:text-base inline-flex items-center gap-2"
              >
                {t("homePage.impact.cta")} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
 {/* A PROPOS - Apple Storytelling */}
        {/* ========================================================================= */}
        <section
          id="apropos"
          className="py-16 sm:py-20 px-6 bg-surface-card border-t border-border/70"
        >
          <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              {t("homePage.about.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {t("homePage.about.subtitle")}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="
              max-w-3xl mx-auto text-text-secondary leading-relaxed
              text-[15px] sm:text-base space-y-5 sm:space-y-6
            "
          >
            <p>
              <Trans
                i18nKey="homePage.about.paragraphs.p1"
                components={[<strong key="about-strong" />]}
              />
            </p>
            <p>{t("homePage.about.paragraphs.p2")}</p>
            <p>{t("homePage.about.paragraphs.p3")}</p>
          </motion.div>

          <div className="text-center mt-10 sm:mt-12">
            <Link
              to="/register"
              className="btn-primary rounded-full px-7 py-3 text-sm sm:text-base inline-flex items-center gap-2"
            >
              {t("homePage.about.cta")} <HeartHandshake size={18} />
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
 {/* CONTACT - Apple Form UI */}
        {/* ========================================================================= */}
        <section
          id="contact"
          className="py-16 sm:py-20 px-6 bg-surface-card border-t border-border/70"
        >
          <div className="max-w-6xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              {t("homePage.contact.title")}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {t("homePage.contact.subtitle")}
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Formulaire */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
 // Meme comportement que ta version actuelle: notification simple cote client.
                notify(t("homePage.contact.form.success"));
              }}
              className="
                bg-surface-main border border-border/70 rounded-3xl p-7 sm:p-8
                shadow-sm flex flex-col gap-5
              "
            >
              {contactFields.map((input) => (
                <div key={input.label} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {input.label}
                  </label>
                  <input
                    type={input.type}
                    required
                    placeholder={input.placeholder}
                    className="
                      w-full border border-border rounded-xl px-3 py-2 text-sm
                      focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
                      bg-surface-card
                    "
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  {t("homePage.contact.form.message.label")}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={t("homePage.contact.form.message.placeholder")}
                  className="
                    w-full border border-border rounded-xl px-3 py-2 text-sm
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none
                    bg-surface-card
                  "
                />
              </div>

              <button
                type="submit"
                className="btn-primary rounded-full self-start px-6 py-2.5 text-sm shadow-sm"
              >
                {t("homePage.contact.form.submit")}
              </button>
            </form>

            {/* Infos de contact */}
            <div className="flex flex-col justify-center space-y-5 sm:space-y-6 text-text-secondary">
              {contactInfos.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
                    <Icon className="text-blue-600" size={18} />
                  </div>
                  <p className="text-sm sm:text-base">{text}</p>
                </div>
              ))}

              <p className="text-sm text-text-muted leading-relaxed pt-2">
                {t("homePage.contact.note")}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
 {/* FOOTER - Apple Minimal */}
      {/* ========================================================================= */}
      <footer className="border-t border-border/70 bg-surface-card/95 text-text-muted text-xs sm:text-sm py-6 px-6 mt-4">
        <div
          className="
            max-w-6xl mx-auto flex flex-col sm:flex-row justify-between
            items-center gap-4 text-center sm:text-left
          "
        >
          <p className="max-w-full whitespace-nowrap leading-none">
            <Trans
              i18nKey="homePage.footer.copyright"
              values={{ year: currentYear }}
              components={[
                <span
                  key="footer-brand"
                  className="text-blue-600 dark:text-blue-300 font-medium"
                />,
              ]}
            />
          </p>

          <div className="flex gap-5 sm:gap-6">
            <a
              href="#accueil"
              className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              {t("homePage.footer.links.home")}
            </a>
            <a
              href="#services"
              className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              {t("homePage.footer.links.services")}
            </a>
            <a
              href="#apropos"
              className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              {t("homePage.footer.links.about")}
            </a>
            <a
              href="#contact"
              className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              {t("homePage.footer.links.contact")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

