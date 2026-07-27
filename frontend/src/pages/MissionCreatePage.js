import { useTranslation } from "react-i18next";

import MissionCreationWizard from "../features/mission-creation/MissionCreationWizard";

export default function MissionCreatePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-6 py-10">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
          {t("seo.pages.missionCreate.title")}
        </h1>
      </div>
      <div className="mt-8">
        <MissionCreationWizard />
      </div>
    </div>
  );
}
