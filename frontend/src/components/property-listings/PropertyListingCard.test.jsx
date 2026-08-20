import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PropertyListingCard from "./PropertyListingCard";
import PropertyPhotoCollage from "./PropertyPhotoCollage";

jest.mock(
  "react-router-dom",
  () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }),
  { virtual: true }
);

jest.mock("react-i18next", () => {
  const t = (key, options = {}) => {
    if (key === "propertyListingsPage.photoCount") return `${options.count} photos`;
    if (key === "propertyListingsPage.openListing") return `Ouvrir ${options.title}`;
    if (key === "propertyListingsPage.viewDetails") return "Voir";
    if (key.endsWith(".house")) return "Maison";
    if (key.endsWith(".sale")) return "À vendre";
    return key;
  };
  return { useTranslation: () => ({ t, i18n: { resolvedLanguage: "fr" } }) };
});

jest.mock("../../services/api", () => ({ getFileUrl: (value) => value }));

const listing = {
  id: 7,
  title: "Villa familiale",
  type: "house",
  transactionType: "sale",
  neighborhood: "Sébénikoro",
  city: "Bamako",
  country: "Mali",
  price: 75000000,
  currency: "XOF",
  photos: ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg"],
};

test("the whole property collage opens the listing", () => {
  render(<PropertyListingCard listing={listing} />);

  const link = screen.getByRole("link", { name: "Ouvrir Villa familiale" });
  expect(link).toHaveAttribute("href", "/immobilier/7");
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getAllByRole("presentation")).toHaveLength(3);
  expect(screen.getByText("4 photos")).toBeInTheDocument();
  expect(screen.getByText("Villa familiale")).toBeInTheDocument();
});

test("an interactive collage exposes each visible photo as a button", async () => {
  const onPhotoClick = jest.fn();
  render(
    <PropertyPhotoCollage
      photos={listing.photos}
      title={listing.title}
      variant="detail"
      onPhotoClick={onPhotoClick}
      photoLabel={(current, total) => `Photo ${current} sur ${total}`}
    />
  );

  await userEvent.click(screen.getByRole("button", { name: "Photo 2 sur 4" }));
  expect(onPhotoClick).toHaveBeenCalledWith(1);
});
