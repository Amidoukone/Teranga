import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  CarFront,
  ChevronDown,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRoundCheck,
  X,
} from "lucide-react";

import MissionRequestForm from "../components/MissionRequestForm";
import PropertyListingCard from "../components/property-listings/PropertyListingCard";
import { listPropertyListings } from "../services/propertyListings";
import { buildTelHref, buildWhatsappHref } from "../utils/phone";

export default function HomePage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [featuredListings, setFeaturedListings] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);

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

  const supportPhone = t("homePage.contact.info.phone");
  const supportEmail = t("homePage.contact.info.email");
  const whatsappHref = buildWhatsappHref(
    supportPhone,
    t("dashboard.contactBar.whatsappPrefill")
  );
  const telHref = buildTelHref(supportPhone);

  return (
    <div className="min-h-screen bg-surface-main text-text-primary">
      <main>
        <section id="accueil" className="relative overflow-hidden px-4 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden" aria-hidden="true">
            <div className="absolute left-[-8rem] top-[-10rem] h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-6xl">
            <header className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
                <ShieldCheck size={15} aria-hidden="true" />
                {t("homePage.simpleHero.badge")}
              </span>
              <h1 className="mt-5 text-[2.25rem] font-bold leading-[1.04] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                {t("homePage.simpleHero.title")}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
                {t("homePage.simpleHero.subtitle")}
              </p>
            </header>

            <section className="mx-auto mt-8 max-w-3xl" aria-labelledby="home-services-title">
              <h2 id="home-services-title" className="text-center text-sm font-semibold text-text-secondary">
                {t("homePage.simpleHero.chooseAction")}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
                <Link
                  to="/taxi"
                  className="group flex min-h-36 flex-col justify-between rounded-3xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-900/10 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 sm:p-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <CarFront size={23} aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="block text-lg">{t("homePage.quickServices.taxi.title")}</strong>
                    <span className="mt-1 block text-sm text-blue-100">{t("homePage.quickServices.taxi.subtitle")}</span>
                  </span>
                </Link>

                <Link
                  to="/livraison"
                  className="group flex min-h-36 flex-col justify-between rounded-3xl bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 sm:p-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <Truck size={23} aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="block text-lg">{t("homePage.quickServices.delivery.title")}</strong>
                    <span className="mt-1 block text-sm text-emerald-50">{t("homePage.quickServices.delivery.subtitle")}</span>
                  </span>
                </Link>

                <Link
                  to="/immobilier"
                  className="group col-span-2 flex min-h-24 items-center gap-4 rounded-3xl border border-border/80 bg-surface-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 sm:p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                    <Building2 size={24} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block text-lg text-text-primary">{t("homePage.quickServices.realEstate.title")}</strong>
                    <span className="mt-0.5 block text-sm text-text-secondary">{t("homePage.quickServices.realEstate.subtitle")}</span>
                  </span>
                  <ArrowRight className="shrink-0 text-text-muted transition group-hover:translate-x-1" size={20} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                  >
                    <MessageCircle size={19} aria-hidden="true" />
                    {t("homePage.simpleHero.whatsapp")}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowRequestForm((current) => !current)}
                  aria-expanded={showRequestForm}
                  aria-controls="home-other-request"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-card px-5 py-3 text-sm font-semibold text-text-primary shadow-sm hover:border-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
                >
                  {showRequestForm ? <X size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
                  {t(showRequestForm ? "homePage.simpleHero.closeRequest" : "homePage.simpleHero.otherRequest")}
                  {!showRequestForm ? <ChevronDown size={17} aria-hidden="true" /> : null}
                </button>
              </div>

              {showRequestForm ? (
                <div id="home-other-request" className="mt-5 scroll-mt-24">
                  <MissionRequestForm />
                </div>
              ) : null}
            </section>

            <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3" aria-label={t("homePage.simpleHero.trustLabel")}>
              {[
                { key: "withoutAccount", icon: Sparkles },
                { key: "human", icon: UserRoundCheck },
                { key: "verified", icon: ShieldCheck },
              ].map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface-card/70 px-4 py-3 text-sm text-text-secondary">
                  <Icon size={18} className="shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  {t(`homePage.simpleHero.trust.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {featuredListings.length > 0 ? (
          <section id="immobilier" className="border-t border-border/70 bg-surface-card px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                    {t("homePage.propertyListings.kicker")}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                    {t("homePage.propertyListings.title")}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-text-secondary sm:text-base">
                    {t("homePage.propertyListings.subtitle")}
                  </p>
                </div>
                <Link
                  to="/immobilier"
                  className="hidden min-h-11 shrink-0 items-center gap-2 rounded-full px-2 text-sm font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 dark:text-blue-300 sm:inline-flex"
                >
                  {t("homePage.propertyListings.viewAll")}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featuredListings.map((listing) => (
                  <PropertyListingCard key={listing.id} listing={listing} compact />
                ))}
              </div>
              <Link
                to="/immobilier"
                className="btn-secondary mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm sm:hidden"
              >
                {t("homePage.propertyListings.viewAll")}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        <section id="contact" className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-5xl gap-6 overflow-hidden rounded-[2rem] border border-blue-500/20 bg-blue-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <MessageCircle size={15} aria-hidden="true" />
                {t("homePage.contact.kicker")}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                {t("homePage.contact.title")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-blue-100 sm:text-base">
                {t("homePage.contact.subtitle")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  {t("homePage.contact.ctaWhatsapp")}
                </a>
              ) : null}
              {telHref ? (
                <a
                  href={telHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  <Phone size={18} aria-hidden="true" />
                  {t("homePage.contact.ctaCall")}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-surface-card px-4 py-8 text-sm text-text-muted sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-bold tracking-wide text-text-primary">Teranga</p>
            <p className="mt-2 max-w-lg leading-relaxed">{t("homePage.footer.note")}</p>
            <p className="mt-3">
              <Trans
                i18nKey="homePage.footer.copyright"
                values={{ year: currentYear }}
                components={[<span key="footer-brand" className="font-medium text-blue-700 dark:text-blue-300" />]}
              />
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label={t("homePage.footer.resourcesTitle")}>
            <Link to="/help-support" className="hover:text-blue-700 dark:hover:text-blue-300">{t("footer.links.helpSupport")}</Link>
            <Link to="/privacy" className="hover:text-blue-700 dark:hover:text-blue-300">{t("footer.links.privacy")}</Link>
            <Link to="/terms" className="hover:text-blue-700 dark:hover:text-blue-300">{t("footer.links.terms")}</Link>
            <a href={`mailto:${supportEmail}`} className="hover:text-blue-700 dark:hover:text-blue-300">{supportEmail}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
