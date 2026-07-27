import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmProvider from "./ConfirmProvider";
import { confirmAction } from "../utils/confirm";

// La modale piège le focus via un listener `keydown` manuel (voir useFocusTrap),
// pas via le comportement natif du navigateur : on simule un vrai événement Tab
// avec fireEvent plutôt que userEvent.tab() (qui déplace le focus directement
// sans déclencher de keydown interceptable, cf. limitation user-event v13).

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

function Trigger() {
  const [result, setResult] = React.useState(null);
  return (
    <button
      type="button"
      onClick={async () => {
        const value = await confirmAction({
          title: "Supprimer",
          message: "Confirmer ?",
          confirmText: "Confirmer",
          cancelText: "Annuler",
        });
        setResult(String(value));
      }}
    >
      Ouvrir{result !== null ? `:${result}` : ""}
    </button>
  );
}

describe("ConfirmProvider", () => {
  test("affiche un dialog accessible, focus initial sur Annuler, et Escape annule + restaure le focus", async () => {
    render(
      <ConfirmProvider>
        <Trigger />
      </ConfirmProvider>
    );

    const triggerButton = screen.getByRole("button", { name: "Ouvrir" });
    userEvent.click(triggerButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Supprimer")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Annuler" });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape", code: "Escape", keyCode: 27 });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(triggerButton).toHaveFocus());
    expect(await screen.findByRole("button", { name: "Ouvrir:false" })).toBeInTheDocument();
  });

  test("Tab depuis le dernier élément focusable revient au premier (piège de focus)", async () => {
    render(
      <ConfirmProvider>
        <Trigger />
      </ConfirmProvider>
    );

    userEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    await screen.findByRole("dialog");

    const cancelButton = screen.getByRole("button", { name: "Annuler" });
    const confirmButton = screen.getByRole("button", { name: "Confirmer" });

    await waitFor(() => expect(cancelButton).toHaveFocus());
    confirmButton.focus();
    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", code: "Tab", keyCode: 9 });
    expect(cancelButton).toHaveFocus();
  });
});
