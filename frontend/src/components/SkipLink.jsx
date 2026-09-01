import React from 'react';
import { useTranslation } from 'react-i18next';

/** WCAG 2.4.1: permet de franchir la navigation au clavier. */
export default function SkipLink() {
  const { t } = useTranslation();
  return (
    <a className="skip-link" href="#main-content">
      {t('accessibility.skipToContent')}
    </a>
  );
}
