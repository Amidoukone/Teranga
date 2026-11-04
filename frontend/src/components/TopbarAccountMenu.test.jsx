import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopbarAccountMenu from "./TopbarAccountMenu";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock("./LanguageSwitcher", () => () => <div data-testid="language-switcher" />);
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => children,
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
}));

function baseProps(overrides = {}) {
  return {
    user: { email: "fatou@example.com" },
    display: "Fatou Diop",
    initial: "F",
    roleLabel: "roles.client",
    open: false,
    onToggle: jest.fn(),
    onClose: jest.fn(),
    onLogout: jest.fn(),
    panelRef: { current: null },
    warmup: (to, handlers = {}) => handlers,
    ...overrides,
  };
}

test("the panel stays closed until the trigger is toggled open", () => {
  render(<TopbarAccountMenu {...baseProps()} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("opening the menu shows the account identity and its email", () => {
  render(<TopbarAccountMenu {...baseProps({ open: true })} />);
  const dialog = screen.getByRole("dialog", { name: "nav.userMenu" });
  expect(dialog).toBeInTheDocument();
  expect(screen.getByText("Fatou Diop")).toBeInTheDocument();
  expect(screen.getByText("fatou@example.com")).toBeInTheDocument();
});

test("falls back to the phone number when the account has no email", () => {
  render(<TopbarAccountMenu {...baseProps({ open: true, user: { phone: "+221700000000" } })} />);
  expect(screen.getByText("+221700000000")).toBeInTheDocument();
});

test("clicking the trigger button calls onToggle", () => {
  const onToggle = jest.fn();
  render(<TopbarAccountMenu {...baseProps({ onToggle })} />);
  userEvent.click(screen.getByRole("button", { name: "nav.userMenu" }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("closing the panel calls onClose and logging out calls onLogout", () => {
  const onClose = jest.fn();
  const onLogout = jest.fn();
  render(<TopbarAccountMenu {...baseProps({ open: true, onClose, onLogout })} />);
  userEvent.click(screen.getByRole("button", { name: "nav.closeMenu" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  userEvent.click(screen.getByRole("menuitem", { name: /nav.logout/ }));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test("the legal links stay collapsed until expanded", () => {
  render(<TopbarAccountMenu {...baseProps({ open: true })} />);
  expect(screen.queryByRole("link", { name: "nav.privacy" })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: /topBar.legal/ }));
  expect(screen.getByRole("link", { name: "nav.privacy" })).toBeInTheDocument();
});
