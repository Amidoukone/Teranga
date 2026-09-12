import { ArrowLeft, CarFront, MessageCircle, Phone, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import TaxiRideRequestForm from "../features/mobility/TaxiRideRequestForm";
import DeliveryRequestForm from "../features/delivery/DeliveryRequestForm";
import SetSeo from "../components/SetSeo";
import { buildTelHref, buildWhatsappHref } from "../utils/phone";

export default function PublicTransportOrderPage({ serviceSlug }) {
  const { t } = useTranslation();
  const isTaxi = serviceSlug === "mobilite";
  const Icon = isTaxi ? CarFront : Truck;
  const translationRoot = isTaxi ? "publicTransportOrder.taxi" : "publicTransportOrder.delivery";
  const supportPhone = t("homePage.contact.info.phone");
  const telHref = buildTelHref(supportPhone);
  const whatsappHref = buildWhatsappHref(
    supportPhone,
    t("dashboard.contactBar.whatsappPrefill")
  );

  return (
    <main className="min-h-screen bg-surface-main px-6 py-10 sm:py-14">
      <SetSeo
        title={t(`${translationRoot}.seoTitle`)}
        description={t(`${translationRoot}.seoDescription`)}
      />
      <div className={isTaxi ? "mx-auto max-w-6xl" : "mx-auto max-w-2xl"}>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={15} />
          {t("publicTransportOrder.backHome")}
        </Link>

        <div className="mx-auto mb-7 mt-8 max-w-xl text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Icon size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {t(`${translationRoot}.title`)}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-text-secondary">
            {t(`${translationRoot}.subtitle`)}
          </p>
          <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">
            {t("publicTransportOrder.noAccountHint")}
          </p>
        </div>

        <section aria-labelledby="direct-order-title" className="mx-auto mb-6 max-w-2xl rounded-3xl border border-blue-500/25 bg-blue-600 p-5 text-white shadow-lg shadow-blue-900/10 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                <Phone size={15} aria-hidden="true" />
                {t("publicTransportOrder.callFirst.kicker")}
              </p>
              <h2 id="direct-order-title" className="mt-2 text-lg font-bold sm:text-xl">
                {t("publicTransportOrder.callFirst.title")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-blue-100">
                {t("publicTransportOrder.callFirst.subtitle")}
              </p>
            </div>
            <div className="grid shrink-0 gap-2 sm:min-w-52">
              {telHref ? <a href={telHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"><Phone size={18} aria-hidden="true" />{t("publicTransportOrder.callFirst.call")}</a> : null}
              {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"><MessageCircle size={17} aria-hidden="true" />{t("publicTransportOrder.callFirst.whatsapp")}</a> : null}
            </div>
          </div>
        </section>

        <div className="mx-auto mb-4 max-w-2xl text-center">
          <p className="text-sm font-semibold text-text-primary">{t("publicTransportOrder.online.title")}</p>
          <p className="mt-1 text-xs text-text-secondary">{t("publicTransportOrder.online.subtitle")}</p>
        </div>

        {isTaxi ? <TaxiRideRequestForm /> : <DeliveryRequestForm />}
      </div>
    </main>
  );
}
