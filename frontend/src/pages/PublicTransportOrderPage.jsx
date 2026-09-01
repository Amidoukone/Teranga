import { ArrowLeft, CarFront, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import TaxiRideRequestForm from "../features/mobility/TaxiRideRequestForm";
import DeliveryRequestForm from "../features/delivery/DeliveryRequestForm";
import SetSeo from "../components/SetSeo";

export default function PublicTransportOrderPage({ serviceSlug }) {
  const { t } = useTranslation();
  const isTaxi = serviceSlug === "mobilite";
  const Icon = isTaxi ? CarFront : Truck;
  const translationRoot = isTaxi ? "publicTransportOrder.taxi" : "publicTransportOrder.delivery";

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

        {isTaxi ? <TaxiRideRequestForm /> : <DeliveryRequestForm />}
      </div>
    </main>
  );
}
