import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

const STEP_KEYS = ["category", "location", "description", "confirm"];

export default function WizardProgress({ currentStep }) {
  const { t } = useTranslation();

  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={STEP_KEYS.length}
      aria-label={t("missionCreation.wizard.stepAnnouncement", {
        current: currentStep,
        total: STEP_KEYS.length,
      })}
      className="mx-auto mb-6 flex max-w-xl items-center justify-between"
    >
      {STEP_KEYS.map((key, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <div key={key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                  isDone
                    ? "border-blue-600 bg-blue-600 text-white"
                    : isActive
                    ? "border-blue-600 text-blue-700 dark:text-blue-300"
                    : "border-border text-text-muted"
                }`}
              >
                {isDone ? <Check size={14} aria-hidden="true" /> : stepNumber}
              </span>
              <span
                className={`hidden text-[0.68rem] font-medium sm:block ${
                  isActive ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {t(`missionCreation.wizard.steps.${key}`)}
              </span>
            </div>
            {stepNumber < STEP_KEYS.length ? (
              <div className={`mx-2 h-px flex-1 ${isDone ? "bg-blue-600" : "bg-border"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
