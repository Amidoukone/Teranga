import React from "react";
import { render, waitFor } from "@testing-library/react";
import SetSeo from "./SetSeo";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      if (key === "seo.defaultTitle") return "English default title";
      if (key === "seo.defaultDescription") return "English default description";
      return key;
    },
    i18n: { language: "en" },
  }),
}));

describe("SetSeo", () => {
  test("applies explicit public SEO values independently from UI language", async () => {
    render(
      <SetSeo
        title="Gestion de biens et services pour la diaspora"
        description="Teranga est la plateforme francophone de reference pour la diaspora."
        language="fr"
        ogLocale="fr_FR"
      />
    );

    await waitFor(() => {
      expect(document.title).toBe("Gestion de biens et services pour la diaspora - Teranga");
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        "content",
        "Teranga est la plateforme francophone de reference pour la diaspora."
      );
      expect(document.querySelector('meta[name="language"]')).toHaveAttribute(
        "content",
        "fr"
      );
      expect(document.querySelector('meta[http-equiv="content-language"]')).toHaveAttribute(
        "content",
        "fr"
      );
      expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute(
        "content",
        "fr_FR"
      );
    });
  });
});
