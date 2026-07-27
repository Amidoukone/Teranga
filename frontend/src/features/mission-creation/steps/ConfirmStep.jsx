import { useTranslation } from "react-i18next";
import { Loader2, Tag, MapPin, Clock, FileText } from "lucide-react";

export default function ConfirmStep({ estimate, loadingEstimate, summary }) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">
        {t("missionCreation.confirm.title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {t("missionCreation.confirm.subtitle")}
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-surface-main/70 p-4">
        <div className="flex items-start gap-3">
          <Tag size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("missionCreation.confirm.summaryCategory")}
            </p>
            <p className="text-sm text-text-primary">{summary.categoryLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <FileText size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("missionCreation.confirm.summaryTitle")}
            </p>
            <p className="text-sm text-text-primary">{summary.title}</p>
          </div>
        </div>
        {summary.address ? (
          <div className="mt-3 flex items-start gap-3">
            <MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("missionCreation.confirm.summaryLocation")}
              </p>
              <p className="text-sm text-text-primary">{summary.address}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-blue-500/25 bg-blue-500/8 p-4">
        {loadingEstimate ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            {t("missionCreation.confirm.loadingEstimate")}
          </div>
        ) : estimate ? (
          <div className="space-y-2">
            {estimate.pricingMode === "fixed_estimate" ? (
              <p className="text-xl font-semibold text-text-primary">
                {estimate.minPrice != null && Number(estimate.minPrice) === Number(estimate.basePrice)
                  ? t("missionCreation.confirm.startingFrom", {
                      amount: estimate.basePrice,
                      currency: estimate.currency,
                    })
                  : t("missionCreation.confirm.priceValue", {
                      amount: estimate.basePrice,
                      currency: estimate.currency,
                    })}
              </p>
            ) : (
              <p className="text-base font-semibold text-text-primary">
                {t("missionCreation.confirm.quoteOnly")}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Clock size={14} />
              {t("missionCreation.confirm.estimatedDelay", {
                minutes: estimate.estimatedDelayMinutes,
              })}
            </p>
            <p className="text-xs text-text-muted">{estimate.note}</p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t("missionCreation.confirm.estimateUnavailable")}</p>
        )}
      </div>
    </div>
  );
}
