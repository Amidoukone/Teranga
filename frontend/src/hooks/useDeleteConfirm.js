import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { confirmAction } from "../utils/confirm";

export function useDeleteConfirm() {
  const { t } = useTranslation();

  const confirmDelete = useCallback(
    async (entityKey) => {
      return confirmAction({
        message: t("common.confirmModal.delete", {
          entity: t(`common.confirmModal.entities.${entityKey}`),
        }),
        danger: true,
      });
    },
    [t]
  );

  const confirmDeleteNamed = useCallback(
    async (entityKey, name) => {
      return confirmAction({
        message: t("common.confirmModal.deleteNamed", {
          entity: t(`common.confirmModal.entities.${entityKey}`),
          name,
        }),
        danger: true,
      });
    },
    [t]
  );

  return {
    confirmDelete,
    confirmDeleteNamed,
  };
}

