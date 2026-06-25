import React from "react";
import { render, waitFor } from "@testing-library/react";
import SetSeo from "./SetSeo";

/* eslint-disable testing-library/no-node-access -- SEO meta tags live in document.head, not in the accessible UI tree. */

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

    await waitFor(() =>
      expect(document.title).toBe("Gestion de biens et services pour la diaspora - Teranga")
    );

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
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://www.teranga-diaspora.com/"
    );
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://www.teranga-diaspora.com/"
    );
  });
});
