import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LanguageSwitcher from "./LanguageSwitcher";
import { getLocalUser, updateMyLanguage } from "../services/auth";
import { setLanguage } from "../i18n";
import { notify } from "../utils/notify";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: "fr" } }),
}));
jest.mock("../i18n", () => ({
  normalizeLanguage: (value) => (["fr", "en"].includes(value) ? value : null),
  setLanguage: jest.fn(),
}));
jest.mock("../services/auth", () => ({
  getLocalUser: jest.fn(),
  updateMyLanguage: jest.fn(),
}));
jest.mock("../utils/notify", () => ({
  notify: Object.assign(jest.fn(), { warning: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getLocalUser.mockReturnValue({ id: 7 });
  updateMyLanguage.mockResolvedValue({});
});

test("saves the new language on the account without warning when the server accepts it", async () => {
  render(<LanguageSwitcher />);
  userEvent.selectOptions(screen.getByLabelText("language.label"), "en");
  await waitFor(() => expect(updateMyLanguage).toHaveBeenCalledWith("en"));
  expect(setLanguage).toHaveBeenCalledWith("en");
  expect(notify.warning).not.toHaveBeenCalled();
});

test("keeps the new display language but warns when the server cannot save it", async () => {
  updateMyLanguage.mockRejectedValue(new Error("network down"));
  render(<LanguageSwitcher />);
  userEvent.selectOptions(screen.getByLabelText("language.label"), "en");
  await waitFor(() => expect(notify.warning).toHaveBeenCalledWith("language.saveError"));
  expect(setLanguage).toHaveBeenCalledWith("en");
});

test("does not call the server for a guest with no account", async () => {
  getLocalUser.mockReturnValue(null);
  render(<LanguageSwitcher />);
  userEvent.selectOptions(screen.getByLabelText("language.label"), "en");
  await waitFor(() => expect(setLanguage).toHaveBeenCalledWith("en"));
  expect(updateMyLanguage).not.toHaveBeenCalled();
  expect(notify.warning).not.toHaveBeenCalled();
});
