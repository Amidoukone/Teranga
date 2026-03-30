import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NavBar from "./NavBar";
import {
  logout,
  me,
  getLocalUser,
  getToken,
  hasSessionHint,
} from "../services/auth";
import { getNotificationSummary } from "../services/notifications";

const mockNavigate = jest.fn();

jest.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === "string" ? to : "/mock-route"} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/dashboard" }),
}), { virtual: true });

jest.mock("../services/auth", () => ({
  me: jest.fn(),
  logout: jest.fn(),
  getLocalUser: jest.fn(),
  getToken: jest.fn(),
  hasSessionHint: jest.fn(),
}));

jest.mock("../services/notifications", () => ({
  getNotificationSummary: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

jest.mock("./GeoSelector", () => function MockGeoSelector() {
  return <div data-testid="geo-selector" />;
});

jest.mock("./LanguageSwitcher", () => function MockLanguageSwitcher() {
  return <div data-testid="language-switcher" />;
});

jest.mock("../utils/routePreload", () => ({
  preloadRoute: jest.fn(),
}));

jest.mock("framer-motion", () => {
  const React = require("react");

  const MockMotionDiv = React.forwardRef(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  MockMotionDiv.displayName = "MockMotionDiv";

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: {
      div: MockMotionDiv,
    },
  };
});

const mockUser = {
  id: 7,
  firstName: "Awa",
  lastName: "Sarr",
  email: "awa@example.com",
  role: "client",
};

describe("NavBar logout flow", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    logout.mockResolvedValue(undefined);
    me.mockResolvedValue({ user: mockUser });
    getLocalUser.mockReturnValue(mockUser);
    getToken.mockReturnValue("test-token");
    hasSessionHint.mockReturnValue(true);
    getNotificationSummary.mockResolvedValue({ unread: 0, byProgress: {} });
  });

  test("redirects to login with a logout success message", async () => {
    render(<NavBar />);

    const [userMenuButton] = await screen.findAllByRole("button", {
      name: "nav.userMenu",
    });
    fireEvent.click(userMenuButton);

    const [logoutButton] = await screen.findAllByRole("menuitem", {
      name: "nav.logout",
    });
    fireEvent.click(logoutButton);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: {
          feedbackMsg: "auth.login.logoutSuccess",
          feedbackType: "success",
        },
      })
    );
  });
});
