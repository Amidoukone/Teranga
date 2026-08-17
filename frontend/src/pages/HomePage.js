import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MessageCircle, Phone, MapPin, Home, ArrowRight, CarFront, Truck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import MissionRequestForm from "../components/MissionRequestForm";
import { listPropertyListings } from "../services/propertyListings";
import { getFileUrl } from "../services/api";

function listingPhotoUrl(listing) {
  const first = Array.isArray(listing?.photos) ? listing.photos[0] : null;
  const path = typeof first === "string" ? first : first?.url;
  return path ? getFileUrl(path) : "";
}

export default function HomePage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [featuredListings, setFeaturedListings] = useState([]);

  useEffect(() => {
    let active = true;
    listPropertyListings()
      .then((rows) => {
        if (active) setFeaturedListings((rows || []).slice(0, 3));
      })
      .catch(() => {
        if (active) setFeaturedListings([]);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const contactInfos = [
    { icon: Phone, text: t("homePage.contact.info.phone") },
    { icon: Mail, text: t("homePage.contact.info.email") },
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
  const emailHref = `mailto:${supportEmail}`;

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
          className="relative overflow-hidden px-6 pb-14 pt-8 sm:pb-20 sm:pt-12"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
            <div className="absolute left-1/2 top-[-11rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[120px]" />
            <div className="absolute right-[-10rem] top-24 h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface-main/85 px-4 py-1.5 text-xs font-medium text-text-secondary shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              {t("homePage.hero.badge")}
            </span>

            <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.045em] text-text-primary sm:text-[3rem]">
              <span className="block text-blue-700 dark:text-blue-300">
                {t("homePage.hero.titleLine1")}
              </span>
              <span className="mt-1.5 block text-text-primary dark:text-white">
                {t("homePage.hero.titleLine2")}
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              <Trans
                i18nKey="homePage.hero.description"
                components={[<strong key="hero-strong" />]}
              />
            </p>
          </div>

          <div className="relative mx-auto mt-8 max-w-xl">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Link
                to="/taxi"
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <CarFront size={20} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text-primary">
                    {t("homePage.quickServices.taxi.title")}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-secondary">
                    {t("homePage.quickServices.taxi.subtitle")}
                  </span>
                </span>
              </Link>
              <Link
                to="/livraison"
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Truck size={20} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text-primary">
                    {t("homePage.quickServices.delivery.title")}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-secondary">
                    {t("homePage.quickServices.delivery.subtitle")}
                  </span>
                </span>
              </Link>
            </div>
            <MissionRequestForm />
          </div>

          <div className="relative mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm"
            >
              {t("homePage.hero.ctaWhatsapp")}
              <ArrowUpRight size={16} />
            </a>
            <Link to="/register" className="btn-secondary rounded-full px-6 py-2.5 text-sm">
              {t("homePage.hero.ctaRegister")}
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center px-3 py-2.5 text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              {t("homePage.hero.ctaLogin")}
            </Link>
          </div>

          <div className="relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-[26px] border border-border/70 bg-surface-main/78 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.28)]">
            <div className="grid divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {heroStats.map((item) => (
                <div key={item.label} className="px-4 py-4 text-center sm:px-5">
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
        </section>

        {featuredListings.length > 0 ? (
          <section
            id="immobilier"
            className="border-t border-border/70 bg-surface-main px-6 py-14 sm:py-16"
          >
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                    {t("homePage.propertyListings.title")}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {t("homePage.propertyListings.subtitle")}
                  </p>
                </div>
                <Link
                  to="/immobilier"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  {t("homePage.propertyListings.viewAll")}
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {featuredListings.map((listing) => {
                  const photo = listingPhotoUrl(listing);
                  return (
                    <Link
                      key={listing.id}
                      to={`/immobilier/${listing.id}`}
                      className="group overflow-hidden rounded-2xl border border-border bg-surface-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-surface-main">
                        {photo ? (
                          <img
                            src={photo}
                            alt={listing.title}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-text-muted">
                            <Home size={28} />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="truncate text-sm font-semibold text-text-primary">
                          {listing.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                          <MapPin size={12} />
                          {listing.neighborhood ? `${listing.neighborhood}, ` : ""}
                          {listing.city}
                          {listing.country ? `, ${listing.country}` : ""}
                        </p>
                        <p className="mt-2 text-sm font-bold text-text-primary">
                          {listing.price} {listing.currency}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section
          id="contact"
          className="border-t border-border/70 bg-surface-card px-6 py-14 sm:py-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-main/70 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
                {t("homePage.contact.kicker")}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              {t("homePage.contact.title")}
            </h2>
            <p className="page-lead mx-auto mt-4 max-w-xl text-base sm:text-lg">
              {t("homePage.contact.subtitle")}
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-xl rounded-[28px] border border-border/70 bg-surface-main/90 p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.22)] sm:p-7">
            <p className="page-kicker">{t("homePage.contact.infoTitle")}</p>

            <div className="mt-5 flex flex-col space-y-4 text-text-secondary">
              {contactInfos.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/12 text-blue-600">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm sm:text-base">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
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

            <p className="mt-6 text-sm leading-relaxed text-text-muted">
              {t("homePage.contact.note")}
            </p>
          </div>
        </section>
      </main>

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
      </footer>
    </div>
  );
}
