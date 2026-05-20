import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Home,
  Truck,
  Globe,
  ClipboardList,
  Wrench,
  FolderKanban,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  CheckCircle2,
  Camera,
  BadgeCheck,
  FileText,
  Maximize2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";

import heroSiteImage from "../assets/images/home-site-hero-teranga.png";
import propertyManagementImage from "../assets/images/services-gestion-biens-teranga.png";
import proofServiceImage from "../assets/images/proof-service-teranga.png";
import administrativeProofImage from "../assets/images/administrative-process-teranga.png";
import inspectionProofImage from "../assets/images/site-inspection-teranga.png";
import deliveryProofImage from "../assets/images/assisted-delivery-teranga.png";
import projectProofImage from "../assets/images/project-followup-teranga.png";

function SectionHeader({ kicker, title, subtitle, align = "center" }) {
  const isCentered = align === "center";

  return (
    <div className={isCentered ? "mx-auto max-w-5xl text-center" : "max-w-2xl text-left"}>
      <div className={`inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-main/70 px-3 py-1 ${isCentered ? "mx-auto" : ""}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
          {kicker}
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl md:text-4xl">
        {title}
      </h2>
      <p className={`page-lead mt-4 text-base sm:text-lg md:text-xl ${isCentered ? "mx-auto max-w-3xl" : "max-w-2xl"}`}>
        {subtitle}
      </p>
    </div>
  );
}

function StoryCard({
  title,
  desc,
  image,
  imageAlt,
  eyebrow,
  proof,
  icon: Icon,
  onOpenImage,
  expandLabel,
}) {
  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-surface-card shadow-[0_14px_40px_-24px_rgba(15,23,42,0.18)]"
    >
      <div className="border-b border-border/70 bg-gradient-to-br from-slate-950/78 via-slate-900/64 to-slate-900/78 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-white/16 bg-white/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/85 backdrop-blur">
            {eyebrow}
          </span>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/16 bg-white/10 text-white backdrop-blur">
            <Icon size={20} />
          </div>
        </div>

        {onOpenImage ? (
          <button
            type="button"
            onClick={() =>
              onOpenImage({
                src: image,
                alt: imageAlt,
                kicker: eyebrow,
                title,
              })
            }
            className="group/image relative flex w-full cursor-zoom-in items-center justify-center rounded-[24px] bg-black/15 p-2 text-left sm:p-3"
            aria-label={`${expandLabel} - ${title}`}
          >
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              className="w-full rounded-[20px] object-contain transition duration-700 group-hover/image:scale-[1.02]"
            />
            <span className="pointer-events-none absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/55 px-3 py-1.5 text-xs font-medium text-white/85 opacity-0 backdrop-blur transition group-hover/image:opacity-100">
              <Maximize2 size={14} />
              {expandLabel}
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-center rounded-[24px] bg-black/15 p-2 sm:p-3">
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              className="w-full rounded-[20px] object-contain transition duration-700 group-hover:scale-[1.02]"
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="text-lg font-semibold text-text-primary sm:text-xl">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary sm:text-base">{desc}</p>
        <div className="mt-5 rounded-2xl border border-border/70 bg-surface-main/80 px-4 py-3 text-sm text-text-secondary">
          {proof}
        </div>
      </div>
    </motion.article>
  );
}

function ImageLightbox({ image, closeLabel, hint, onClose }) {
  return (
    <AnimatePresence>
      {image ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/88 p-4 sm:p-6"
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/15"
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>

          <motion.figure
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/12 bg-slate-950/55 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.75)] backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                  {image.kicker}
                </p>
                <p className="mt-1 text-lg font-semibold leading-tight text-white sm:text-xl">
                  {image.title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15 sm:inline-flex"
              >
                {closeLabel}
              </button>
            </div>

            <div className="flex max-h-[80vh] items-center justify-center p-3 sm:p-5">
              <img
                src={image.src}
                alt={image.alt}
                className="max-h-[72vh] w-auto max-w-full rounded-[24px] object-contain"
              />
            </div>

            <div className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
              {hint}
            </div>
          </motion.figure>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    if (!activeImage || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeImage]);

  const supportedPropertyTypes = [
    "house",
    "apartment",
    "land",
    "automobile",
    "commercial",
  ];

  const supportedPropertyTypeLabels = supportedPropertyTypes.map((type) =>
    t(`labels.property.types.${type}`, { defaultValue: type })
  );

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

  const quickLinks = [
    { href: "#actions", label: t("homePage.quickNav.actions") },
    { href: "#preuves", label: t("homePage.quickNav.proofs") },
    { href: "#services", label: t("homePage.quickNav.services") },
    { href: "#contact", label: t("homePage.quickNav.contact") },
  ];

  const quickActions = [
    {
      icon: Wrench,
      title: t("homePage.quickActions.items.service.title"),
      desc: t("homePage.quickActions.items.service.desc"),
      prefill: t("homePage.quickActions.items.service.prefill"),
    },
    {
      icon: ClipboardList,
      title: t("homePage.quickActions.items.mission.title"),
      desc: t("homePage.quickActions.items.mission.desc"),
      prefill: t("homePage.quickActions.items.mission.prefill"),
    },
    {
      icon: FileText,
      title: t("homePage.quickActions.items.administrative.title"),
      desc: t("homePage.quickActions.items.administrative.desc"),
      prefill: t("homePage.quickActions.items.administrative.prefill"),
    },
    {
      icon: Camera,
      title: t("homePage.quickActions.items.construction.title"),
      desc: t("homePage.quickActions.items.construction.desc"),
      prefill: t("homePage.quickActions.items.construction.prefill"),
    },
    {
      icon: Truck,
      title: t("homePage.quickActions.items.delivery.title"),
      desc: t("homePage.quickActions.items.delivery.desc"),
      prefill: t("homePage.quickActions.items.delivery.prefill"),
    },
    {
      icon: FolderKanban,
      title: t("homePage.quickActions.items.project.title"),
      desc: t("homePage.quickActions.items.project.desc"),
      prefill: t("homePage.quickActions.items.project.prefill"),
    },
  ];

  const proofCards = [
    {
      icon: BadgeCheck,
      title: t("homePage.proofs.items.service.title"),
      desc: t("homePage.proofs.items.service.desc"),
      image: proofServiceImage,
      imageAlt: t("homePage.proofs.items.service.alt"),
      eyebrow: t("homePage.proofs.items.service.eyebrow"),
      proof: t("homePage.proofs.items.service.proof"),
    },
    {
      icon: FileText,
      title: t("homePage.proofs.items.administrative.title"),
      desc: t("homePage.proofs.items.administrative.desc"),
      image: administrativeProofImage,
      imageAlt: t("homePage.proofs.items.administrative.alt"),
      eyebrow: t("homePage.proofs.items.administrative.eyebrow"),
      proof: t("homePage.proofs.items.administrative.proof"),
    },
    {
      icon: Camera,
      title: t("homePage.proofs.items.inspection.title"),
      desc: t("homePage.proofs.items.inspection.desc"),
      image: inspectionProofImage,
      imageAlt: t("homePage.proofs.items.inspection.alt"),
      eyebrow: t("homePage.proofs.items.inspection.eyebrow"),
      proof: t("homePage.proofs.items.inspection.proof"),
    },
    {
      icon: Truck,
      title: t("homePage.proofs.items.delivery.title"),
      desc: t("homePage.proofs.items.delivery.desc"),
      image: deliveryProofImage,
      imageAlt: t("homePage.proofs.items.delivery.alt"),
      eyebrow: t("homePage.proofs.items.delivery.eyebrow"),
      proof: t("homePage.proofs.items.delivery.proof"),
    },
    {
      icon: FolderKanban,
      title: t("homePage.proofs.items.project.title"),
      desc: t("homePage.proofs.items.project.desc"),
      image: projectProofImage,
      imageAlt: t("homePage.proofs.items.project.alt"),
      eyebrow: t("homePage.proofs.items.project.eyebrow"),
      proof: t("homePage.proofs.items.project.proof"),
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

  const serviceVisualPoints = [
    t("homePage.services.visual.points.p1"),
    t("homePage.services.visual.points.p2"),
    t("homePage.services.visual.points.p3"),
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

  const aboutTrustPoints = [
    {
      icon: Camera,
      text: t("homePage.about.trustPoints.p1"),
    },
    {
      icon: FileText,
      text: t("homePage.about.trustPoints.p2"),
    },
    {
      icon: BadgeCheck,
      text: t("homePage.about.trustPoints.p3"),
    },
  ];

  const contactInfos = [
    { icon: Mail, text: t("homePage.contact.info.email") },
    { icon: Phone, text: t("homePage.contact.info.phone") },
    { icon: MapPin, text: t("homePage.contact.info.address") },
  ];
  const supportPhoneDisplay = t("homePage.contact.info.phone");
  const supportPhoneWhatsapp = supportPhoneDisplay
    .replace(/[^\d]/g, "")
    .replace(/^00/, "");
  const supportEmail = t("homePage.contact.info.email");
  const buildWhatsappHref = (message) =>
    `https://wa.me/${supportPhoneWhatsapp}?text=${encodeURIComponent(message)}`;
  const whatsappHref = buildWhatsappHref(t("dashboard.contactBar.whatsappPrefill"));
  const heroWhatsappHref = buildWhatsappHref(
    t("homePage.quickActions.items.service.prefill")
  );
  const emailHref = `mailto:${supportEmail}`;

  const openImage = (config) => setActiveImage(config);

  return (
    <div className="min-h-screen scroll-smooth bg-gradient-to-br from-surface-main via-surface-card to-surface-main text-text-primary">
      <main className="flex-1">
        <section className="px-6 pt-6 sm:pt-8">
          <div className="relative mx-auto flex max-w-6xl flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 px-4 py-4 shadow-sm dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-cyan-900/20 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative min-w-0">
              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                {t("dashboard.contactBar.badge")}
              </span>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-emerald-900 dark:text-emerald-100 sm:text-xl">
                {t("dashboard.contactBar.title")}
              </h2>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/90">
                {t("dashboard.contactBar.subtitle")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-600/20 bg-white/70 px-2.5 py-1 font-semibold text-emerald-800 dark:border-emerald-300/30 dark:bg-black/20 dark:text-emerald-100">
                  <MessageCircle size={15} />
                  {supportPhoneDisplay}
                </span>
                <span className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-emerald-600/20 bg-white/70 px-2.5 py-1 text-emerald-800 dark:border-emerald-300/30 dark:bg-black/20 dark:text-emerald-100">
                  <Mail size={15} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-all leading-snug">
                    {supportEmail}
                  </span>
                </span>
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/20 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                {t("dashboard.contactBar.whatsappCta")}
                <ArrowUpRight size={15} />
              </a>
              <a
                href={emailHref}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/30 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 hover:bg-white dark:bg-transparent dark:text-emerald-100 dark:hover:bg-emerald-900/30"
              >
                {t("dashboard.contactBar.emailCta")}
              </a>
            </div>
          </div>
        </section>

        <section
          id="accueil"
          className="relative overflow-hidden px-6 pb-12 pt-8 sm:pb-16 sm:pt-12 lg:pb-24 lg:pt-18"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
            <div className="absolute left-1/2 top-[-11rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[120px]" />
            <div className="absolute right-[-10rem] top-24 h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-border/70 bg-surface-card/75 p-4 shadow-[0_28px_70px_-34px_rgba(15,23,42,0.28)] backdrop-blur sm:rounded-[38px] sm:p-6 lg:p-8 xl:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[-6rem] top-[-5rem] h-56 w-56 rounded-full bg-amber-400/10 blur-[95px]" />
              <div className="absolute bottom-[-7rem] right-[-4rem] h-64 w-64 rounded-full bg-blue-500/10 blur-[110px]" />
            </div>

            <div className="relative grid items-center gap-8 sm:gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 xl:gap-16">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left xl:max-w-2xl"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface-main/85 px-4 py-1.5 text-xs font-medium text-text-secondary shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {t("homePage.hero.badge")}
                </span>

                <h1 className="mt-5 text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.045em] text-text-primary sm:mt-6 sm:text-[3rem] lg:text-[3.1rem] xl:text-[3.7rem]">
                  <span className="block text-blue-700 dark:text-blue-300">
                    {t("homePage.hero.titleLine1")}
                  </span>
                  <span className="mt-1.5 block text-text-primary dark:text-white">
                    {t("homePage.hero.titleLine2")}
                  </span>
                </h1>

                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-secondary sm:mt-5 sm:text-[1.02rem] lg:mx-0 lg:max-w-2xl">
                  <Trans
                    i18nKey="homePage.hero.description"
                    components={[<strong key="hero-strong" />]}
                  />
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3.5 sm:mt-7 sm:gap-4 lg:justify-start">
                  <a
                    href={heroWhatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm sm:text-base"
                  >
                    {t("homePage.hero.ctaWhatsapp")}
                    <ArrowUpRight size={18} />
                  </a>

                  <Link
                    to="/register"
                    className="btn-secondary rounded-full px-7 py-3 text-sm sm:text-base"
                  >
                    {t("homePage.hero.ctaRegister")}
                  </Link>
                </div>

                <div className="mt-4">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition hover:text-text-primary"
                  >
                    {t("homePage.hero.ctaLogin")}
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <div className="mt-7 overflow-hidden rounded-[26px] border border-border/70 bg-surface-main/78 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.28)]">
                  <div className="grid divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {heroStats.map((item) => (
                      <div key={item.label} className="px-4 py-4 text-left sm:px-5">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 lg:max-w-lg">
                  <p className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-surface-main/60 px-4 py-2 text-sm leading-relaxed text-text-muted shadow-sm lg:justify-start">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {t("homePage.hero.tagline")}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.1, ease: "easeOut" }}
                className="relative mx-auto w-full max-w-xl lg:max-w-none"
              >
                <div className="overflow-hidden rounded-[32px] border border-border/70 bg-surface-card/95 p-3 shadow-[0_34px_80px_-34px_rgba(15,23,42,0.34)] sm:p-4 lg:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-border/80 bg-surface-main/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                      {t("homePage.hero.visual.label")}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
                      {t("homePage.hero.visual.proofBadge")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openImage({
                        src: heroSiteImage,
                        alt: t("homePage.hero.visual.imageAlt"),
                        kicker: t("homePage.hero.visual.label"),
                        title: t("homePage.hero.visual.title"),
                      })
                    }
                    className="group/image relative flex min-h-[18.5rem] w-full cursor-zoom-in items-center justify-center rounded-[28px] bg-gradient-to-br from-slate-950/82 via-slate-900/68 to-slate-900/82 p-2 text-left sm:min-h-[24rem] sm:p-3 lg:min-h-[29rem] lg:p-4"
                    aria-label={`${t("homePage.lightbox.open")} - ${t("homePage.hero.visual.title")}`}
                  >
                    <img
                      src={heroSiteImage}
                      alt={t("homePage.hero.visual.imageAlt")}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      className="max-h-[65vh] w-full rounded-[24px] object-contain transition duration-300 group-hover/image:scale-[1.01]"
                    />
                    <span className="pointer-events-none absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/55 px-3 py-1.5 text-xs font-medium text-white/85 opacity-0 backdrop-blur transition group-hover/image:opacity-100">
                      <Maximize2 size={14} />
                      {t("homePage.lightbox.open")}
                    </span>
                  </button>

                  <div className="border-t border-border/60 px-2 pb-1 pt-4 sm:px-3 sm:pt-5 lg:px-2">
                    <h2 className="text-base font-semibold leading-tight text-text-primary sm:text-[1.35rem]">
                      {t("homePage.hero.visual.title")}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:text-base">
                      {t("homePage.hero.visual.description")}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <nav className="relative mx-auto mt-5 flex max-w-5xl flex-wrap items-center justify-center gap-3">
            {quickLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center rounded-full border border-border/80 bg-surface-card/88 px-4 py-2 text-sm text-text-secondary shadow-sm transition hover:-translate-y-0.5 hover:bg-surface-main hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </section>

        <section
          id="actions"
          className="border-t border-border/70 bg-surface-main px-6 py-16 sm:py-20"
        >
          <SectionHeader
            kicker={t("homePage.quickActions.kicker")}
            title={t("homePage.quickActions.title")}
            subtitle={t("homePage.quickActions.subtitle")}
          />

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map(({ icon: Icon, title, desc, prefill }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
                whileHover={{ y: -3, scale: 1.01 }}
                className="flex h-full flex-col rounded-[28px] border border-border/70 bg-surface-card px-6 py-6 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.2)] sm:px-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-text-primary sm:text-xl">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary sm:text-base">
                  {desc}
                </p>
                <a
                  href={buildWhatsappHref(prefill)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center justify-between gap-3 rounded-2xl border border-emerald-600/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 hover:bg-emerald-500/15 dark:text-emerald-100"
                >
                  <span>{t("homePage.quickActions.cta")}</span>
                  <ArrowUpRight size={16} />
                </a>
              </motion.div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-[28px] border border-emerald-500/20 bg-emerald-500/8 px-6 py-5 text-center text-sm leading-relaxed text-text-secondary shadow-[0_16px_40px_-30px_rgba(16,185,129,0.3)] sm:text-base">
            {t("homePage.quickActions.note")}
          </div>
        </section>

        <section
          id="preuves"
          className="border-t border-border/70 bg-surface-card px-6 py-16 sm:py-20"
        >
          <SectionHeader
            kicker={t("homePage.proofs.kicker")}
            title={t("homePage.proofs.title")}
            subtitle={t("homePage.proofs.subtitle")}
          />

          <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-3">
            {proofCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
                className={index === 4 ? "lg:col-span-3 xl:col-span-1" : ""}
              >
                <StoryCard
                  {...card}
                  onOpenImage={openImage}
                  expandLabel={t("homePage.lightbox.open")}
                />
              </motion.div>
            ))}
          </div>
        </section>

        <section
          id="services"
          className="border-t border-border/70 bg-surface-main px-6 py-16 sm:py-20"
        >
          <SectionHeader
            kicker={t("homePage.services.kicker")}
            title={t("homePage.services.title")}
            subtitle={t("homePage.services.subtitle")}
          />

          <div className="mx-auto mt-8 max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-muted sm:text-sm">
              {t("homePage.services.assetTypesTitle")}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {supportedPropertyTypeLabels.map((label, idx) => (
                <span
                  key={`${label}-${idx}`}
                  className="inline-flex items-center rounded-full border border-border/80 bg-surface-main/80 px-3 py-1 text-xs text-text-secondary sm:text-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="space-y-5"
            >
              <figure className="overflow-hidden rounded-[30px] border border-border/70 bg-surface-main shadow-[0_22px_55px_-28px_rgba(15,23,42,0.28)]">
                <button
                  type="button"
                  onClick={() =>
                    openImage({
                      src: propertyManagementImage,
                      alt: t("homePage.services.visual.imageAlt"),
                      kicker: t("homePage.services.visual.kicker"),
                      title: t("homePage.services.visual.title"),
                    })
                  }
                  className="group/image relative flex w-full cursor-zoom-in items-center justify-center bg-gradient-to-br from-slate-950/80 via-slate-900/65 to-slate-900/78 p-3 text-left sm:p-4"
                  aria-label={`${t("homePage.lightbox.open")} - ${t("homePage.services.visual.title")}`}
                >
                  <img
                    src={propertyManagementImage}
                    alt={t("homePage.services.visual.imageAlt")}
                    loading="lazy"
                    decoding="async"
                    className="w-full rounded-[24px] object-contain transition duration-300 group-hover/image:scale-[1.01]"
                  />
                  <span className="pointer-events-none absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/55 px-3 py-1.5 text-xs font-medium text-white/85 opacity-0 backdrop-blur transition group-hover/image:opacity-100">
                    <Maximize2 size={14} />
                    {t("homePage.lightbox.open")}
                  </span>
                </button>
              </figure>

              <div className="rounded-[30px] border border-border/70 bg-surface-main/85 p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.32)] sm:p-7">
                <p className="page-kicker">{t("homePage.services.visual.kicker")}</p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight text-text-primary">
                  {t("homePage.services.visual.title")}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                  {t("homePage.services.visual.description")}
                </p>

                <div className="mt-5 grid gap-3">
                  {serviceVisualPoints.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={18} />
                      <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="grid gap-5">
              {serviceCards.map(({ icon: Icon, title, desc }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="flex h-full flex-col rounded-[28px] border border-border/70 bg-surface-main px-6 py-6 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.25)] sm:px-7"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-600">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-text-primary sm:text-xl">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary sm:text-base">
                    {desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="pourquoi"
          className="border-t border-border/70 bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-6 py-16 sm:py-20"
        >
          <SectionHeader
            kicker={t("homePage.why.kicker")}
            title={t("homePage.why.title")}
            subtitle={t("homePage.why.subtitle")}
          />

          <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
            {pillars.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="flex h-full flex-col rounded-3xl border border-border/70 bg-surface-card/90 px-5 py-5 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.24)]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {`0${index + 1}`}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary sm:text-base">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section
          id="contact"
          className="border-t border-border/70 bg-surface-card px-6 py-16 sm:py-20"
        >
          <SectionHeader
            kicker={t("homePage.contact.kicker")}
            title={t("homePage.contact.title")}
            subtitle={t("homePage.contact.subtitle")}
          />

          <div className="mx-auto mt-10 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[30px] border border-border/70 bg-surface-main/85 p-6 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.22)] sm:p-8">
              <p className="page-kicker">{t("homePage.about.trustLabel")}</p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-text-primary">
                {t("homePage.contact.sideTitle")}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                {t("homePage.contact.sideText")}
              </p>

              <div className="mt-6 grid gap-4">
                {aboutTrustPoints.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-600">
                      <Icon size={18} />
                    </div>
                    <p className="text-sm leading-relaxed text-text-secondary sm:text-base">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm"
                >
                  {t("homePage.contact.ctaWhatsapp")}
                  <ArrowUpRight size={16} />
                </a>
                <a
                  href={emailHref}
                  className="btn-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm"
                >
                  {t("homePage.contact.ctaEmail")}
                  <Mail size={16} />
                </a>
              </div>
            </div>

            <div className="rounded-[30px] border border-border/70 bg-surface-main/90 p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.22)] sm:p-7">
              <p className="page-kicker">{t("homePage.contact.kicker")}</p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-text-primary">
                {t("homePage.contact.infoTitle")}
              </h3>

              <div className="mt-6 flex flex-col space-y-5 text-text-secondary sm:space-y-6">
                {contactInfos.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/12 text-blue-600">
                      <Icon size={18} />
                    </div>
                    <p className="text-sm sm:text-base">{text}</p>
                  </div>
                ))}
              </div>

              <p className="pt-6 text-sm leading-relaxed text-text-muted">
                {t("homePage.contact.note")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <ImageLightbox
        image={activeImage}
        closeLabel={t("homePage.lightbox.close")}
        hint={t("homePage.lightbox.hint")}
        onClose={() => setActiveImage(null)}
      />

      <footer className="mt-4 border-t border-border/70 bg-surface-card/95 px-6 py-8 text-xs text-text-muted sm:text-sm">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div className="text-center lg:text-left">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Teranga
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
              {t("homePage.footer.note")}
            </p>
            <p className="mt-4 max-w-full whitespace-nowrap leading-none">
              <Trans
                i18nKey="homePage.footer.copyright"
                values={{ year: currentYear }}
                components={[
                  <span
                    key="footer-brand"
                    className="font-medium text-blue-600 dark:text-blue-300"
                  />,
                ]}
              />
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="text-center sm:text-left">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-text-muted">
                {t("homePage.footer.sectionTitle")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-4 sm:justify-start">
                <a
                  href="#accueil"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("homePage.footer.links.home")}
                </a>
                <a
                  href="#services"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("homePage.footer.links.services")}
                </a>
                <a
                  href="#pourquoi"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("homePage.footer.links.about")}
                </a>
                <a
                  href="#contact"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("homePage.footer.links.contact")}
                </a>
              </div>
            </div>

            <div className="text-center sm:text-left">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-text-muted">
                {t("homePage.footer.resourcesTitle")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-4 sm:justify-start">
                <Link
                  to="/help-support"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("footer.links.helpSupport")}
                </Link>
                <Link
                  to="/privacy"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("footer.links.privacy")}
                </Link>
                <Link
                  to="/terms"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("footer.links.terms")}
                </Link>
                <Link
                  to="/legal"
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {t("footer.links.legal")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

