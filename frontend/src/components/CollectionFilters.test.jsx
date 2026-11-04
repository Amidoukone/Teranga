import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollectionFilters from "./CollectionFilters";

const options = [
  { value: "all", label: "Tous" },
  { value: "service", label: "Services" },
];

function baseProps(overrides = {}) {
  return {
    id: "requests",
    searchLabel: "Rechercher",
    query: "",
    onQueryChange: jest.fn(),
    onSubmit: jest.fn(),
    kind: "all",
    onKindChange: jest.fn(),
    kindLabel: "Type",
    options,
    findLabel: "Chercher",
    placeholder: "Rechercher une demande",
    ...overrides,
  };
}

test("submits the current query without reloading the page", () => {
  const onSubmit = jest.fn();
  render(<CollectionFilters {...baseProps({ onSubmit })} />);
  userEvent.click(screen.getByRole("button", { name: "Chercher" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("reports each keystroke and kind change to the parent", () => {
  const onQueryChange = jest.fn();
  const onKindChange = jest.fn();
  render(<CollectionFilters {...baseProps({ onQueryChange, onKindChange })} />);
  userEvent.type(screen.getByLabelText("Rechercher"), "a");
  expect(onQueryChange).toHaveBeenCalledWith("a");
  userEvent.selectOptions(screen.getByLabelText("Type"), "service");
  expect(onKindChange).toHaveBeenCalledWith("service");
});

test("disables every control and ignores submission while disabled", () => {
  const onSubmit = jest.fn();
  render(<CollectionFilters {...baseProps({ onSubmit, disabled: true })} />);
  expect(screen.getByLabelText("Rechercher")).toBeDisabled();
  expect(screen.getByLabelText("Type")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Chercher" })).toBeDisabled();
  userEvent.click(screen.getByRole("button", { name: "Chercher" }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("exposes the hint through aria-describedby only when provided", () => {
  const { rerender } = render(<CollectionFilters {...baseProps()} />);
  expect(screen.getByLabelText("Rechercher")).not.toHaveAttribute("aria-describedby");

  rerender(<CollectionFilters {...baseProps({ hint: "Filtre les dossiers par mot-clé" })} />);
  const input = screen.getByLabelText("Rechercher");
  expect(input).toHaveAttribute("aria-describedby", "requests-hint");
  expect(screen.getByText("Filtre les dossiers par mot-clé")).toHaveAttribute("id", "requests-hint");
});
