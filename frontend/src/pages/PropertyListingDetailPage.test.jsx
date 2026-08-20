import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PropertyListingDetailPage from "./PropertyListingDetailPage";
import { getPropertyListing } from "../services/propertyListings";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useParams: () => ({ id: "9" }),
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => {
  const t = (key, options = {}) => {
    const labels = {
      "propertyListingsPage.loading": "Chargement",
      "propertyListingsPage.type.house": "Maison",
      "propertyListingsPage.transactionType.sale": "À vendre",
      "propertyListingDetailPage.backToList": "Toutes les annonces",
      "propertyListingDetailPage.whatsappCta": "WhatsApp",
      "propertyListingDetailPage.callCta": "Appeler",
      "propertyListingDetailPage.descriptionTitle": "À propos de ce bien",
      "propertyListingDetailPage.contactTitle": "Intéressé par ce bien ?",
      "propertyListingDetailPage.contactHint": "Contact géré par Teranga",
      "propertyListingDetailPage.closeGallery": "Fermer la galerie",
      "propertyListingDetailPage.previousPhoto": "Photo précédente",
      "propertyListingDetailPage.nextPhoto": "Photo suivante",
    };
    if (key === "propertyListingDetailPage.openGallery") return `Voir les ${options.count} photos`;
    if (key === "propertyListingDetailPage.photoButtonLabel") return `Ouvrir la photo ${options.current} sur ${options.total}`;
    if (key === "propertyListingDetailPage.galleryCounter") return `Photo ${options.current} sur ${options.total}`;
    if (key === "propertyListingDetailPage.photoLabel") return `${options.title}, photo ${options.current} sur ${options.total}`;
    if (key === "propertyListingDetailPage.whatsappPrefill") return `Annonce ${options.title}`;
    return labels[key] || key;
  };
  return { useTranslation: () => ({ t, i18n: { resolvedLanguage: "fr" } }) };
});

jest.mock("../services/propertyListings", () => ({ getPropertyListing: jest.fn() }));
jest.mock("../services/api", () => ({ getFileUrl: (value) => value }));
jest.mock("../components/SetSeo", () => () => null);

const listing = {
  id: 9,
  title: "Villa avec jardin",
  description: "Une maison calme et lumineuse.",
  type: "house",
  transactionType: "sale",
  neighborhood: "Badalabougou",
  city: "Bamako",
  country: "Mali",
  price: 120000000,
  currency: "XOF",
  contactPhone: "+223 70 45 33 45",
  photos: ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg"],
};

test("opens the photo collage in an accessible gallery and keeps direct contacts", async () => {
  getPropertyListing.mockResolvedValue(listing);
  render(<PropertyListingDetailPage />);

  expect(await screen.findByRole("heading", { name: "Villa avec jardin", level: 1 })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir la photo 1 sur 5" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByAltText("Villa avec jardin, photo 1 sur 5")).toHaveAttribute("src", "/1.jpg");

  await userEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
  expect(screen.getByAltText("Villa avec jardin, photo 2 sur 5")).toHaveAttribute("src", "/2.jpg");

  const whatsappLinks = screen.getAllByRole("link", { name: "WhatsApp" });
  expect(whatsappLinks[0]).toHaveAttribute("href", expect.stringContaining("https://wa.me/22370453345"));
  expect(screen.getAllByRole("link", { name: "Appeler" })[0]).toHaveAttribute("href", "tel:+22370453345");
});
