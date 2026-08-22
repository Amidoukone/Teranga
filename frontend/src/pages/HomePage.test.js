import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomePage from "./HomePage";
import { listPropertyListings } from "../services/propertyListings";

jest.mock(
  "react-router-dom",
  () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }),
  { virtual: true }
);

jest.mock("react-i18next", () => {
  const labels = {
    "homePage.simpleHero.title": "De quoi avez-vous besoin aujourd’hui ?",
    "homePage.simpleHero.chooseAction": "Choisissez un service",
    "homePage.simpleHero.otherRequest": "Faire une autre demande",
    "homePage.simpleHero.closeRequest": "Fermer le formulaire",
    "homePage.quickServices.taxi.title": "Teranga Taxi",
    "homePage.quickServices.delivery.title": "Livraison",
    "homePage.quickServices.realEstate.title": "Annonces immobilières",
    "homePage.propertyListings.title": "Annonces immobilières",
    "homePage.propertyListings.viewAll": "Voir toutes les annonces",
    "homePage.contact.info.phone": "00223 70453345",
    "homePage.contact.info.email": "contact@teranga.test",
  };
  const t = (key) => labels[key] || key;
  return {
    useTranslation: () => ({ t }),
    Trans: ({ i18nKey }) => <>{i18nKey}</>,
  };
});

jest.mock("../services/propertyListings", () => ({ listPropertyListings: jest.fn() }));
jest.mock("../services/api", () => ({ getFileUrl: (value) => value }));
jest.mock("../components/MissionRequestForm", () => () => <div>Formulaire autre demande</div>);

beforeEach(() => {
  listPropertyListings.mockResolvedValue([]);
});

test("shows the three main public actions and keeps the long form collapsed", async () => {
  render(<HomePage />);

  await waitFor(() => expect(listPropertyListings).toHaveBeenCalledTimes(1));

  expect(screen.getByRole("heading", { name: "De quoi avez-vous besoin aujourd’hui ?" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Teranga Taxi/ })).toHaveAttribute("href", "/taxi");
  expect(screen.getByRole("link", { name: /Livraison/ })).toHaveAttribute("href", "/livraison");
  expect(screen.getByRole("heading", { name: "Annonces immobilières" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Voir toutes les annonces/ })).toHaveAttribute("href", "/immobilier");
  expect(screen.queryByText("Formulaire autre demande")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Faire une autre demande/ }));
  expect(screen.getByText("Formulaire autre demande")).toBeInTheDocument();
});
