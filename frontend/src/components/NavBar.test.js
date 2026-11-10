import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import NavBar from "./NavBar";
import {
  logout,
  me,
  getLocalUser,
  getToken,
  hasSessionHint,
} from "../services/auth";
import { getNotificationSummary, markAllNotificationsRead } from "../services/notifications";

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
    getNotificationSummary.mockImplementation(() => new Promise(() => {}));
    markAllNotificationsRead.mockClear();
  });

  test("ignores a notification response that arrives after unmount", async () => {
    let resolveSummary;
    getNotificationSummary.mockImplementation(() => new Promise((resolve) => {
      resolveSummary = resolve;
    }));

    const { unmount } = render(<NavBar />);
    await waitFor(() => expect(getNotificationSummary).toHaveBeenCalled());
    unmount();

    await act(async () => {
      resolveSummary({ unread: 9, byProgress: {} });
    });
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

  test("groups transport tools in Management for administrators", async () => {
    const adminUser = {
      ...mockUser,
      role: "admin",
      countryId: 1,
    };
    getLocalUser.mockReturnValue(adminUser);
    me.mockResolvedValue({ user: adminUser });

    render(<NavBar />);

    expect((await screen.findAllByRole('link', { name: 'nav.management' })).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('link', { name: 'nav.taxiOperations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.deliveryOperations' })).not.toBeInTheDocument();
  });

  test("shows the unified request entry points directly for clients", async () => {
    render(<NavBar />);

    const newRequestLinks = await screen.findAllByRole("link", {
      name: "nav.newRequest",
    });
    const requestLinks = await screen.findAllByRole("link", {
      name: "nav.myRequests",
    });
    expect(newRequestLinks.length).toBeGreaterThanOrEqual(2);
    expect(requestLinks.length).toBeGreaterThanOrEqual(2);
    newRequestLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/demandes/nouvelle");
    });
    requestLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/demandes");
    });
  });

  test("groups specialized administration behind Management", async () => {
    const adminUser = { ...mockUser, role: "admin", countryId: 1 };
    getLocalUser.mockReturnValue(adminUser);
    me.mockResolvedValue({ user: adminUser });

    render(<NavBar />);

    expect(screen.queryByRole("link", { name: "nav.adminServices" })).not.toBeInTheDocument();
    screen.getAllByRole('link', { name: 'nav.management' }).forEach((link) => expect(link).toHaveAttribute('href', '/gestion'));
  });

  test("the admin mobile menu contains account controls without a second tool directory", async () => {
    const adminUser = { ...mockUser, role: "admin", countryId: 1 };
    getLocalUser.mockReturnValue(adminUser);
    me.mockResolvedValue({ user: adminUser });

    render(<NavBar />);
    fireEvent.click(screen.getByRole("button", { name: "nav.openMoreMenu" }));
    const panel = await screen.findByRole("dialog", { name: "nav.menu" });

    expect(within(panel).getByRole('link', { name: /nav.settings/ })).toHaveAttribute('href', '/settings');
    expect(within(panel).queryByRole('link', { name: 'nav.adminServices' })).not.toBeInTheDocument();
  });

  test.each(['client', 'agent', 'provider', 'admin'])('puts the centre first on desktop and mobile for %s', async (role) => {
    const account = { ...mockUser, role, countryId: 1 };
    getLocalUser.mockReturnValue(account); me.mockResolvedValue({ user: account });
    render(<NavBar />);
    const navigation = await screen.findAllByRole('navigation', { name: /nav\.(mainNavigation|bottomNavigation)/ });
    expect(navigation).toHaveLength(2);
    navigation.forEach((nav) => {
      const links = within(nav).getAllByRole('link').filter((link) => link.getAttribute('href') !== '/' && !link.getAttribute('href').includes('?'));
      expect(links[0]).toHaveAttribute('href', '/operations');
      expect(within(nav).queryByRole('link', { name: 'nav.tasks' })).not.toBeInTheDocument();
      expect(links.some((link) => link.getAttribute('href') === '/tasks')).toBe(false);
      expect(links.filter((link) => link.getAttribute('href') === '/gestion')).toHaveLength(role === 'admin' ? 1 : 0);
      expect(links.some((link) => link.getAttribute('href') === '/dashboard')).toBe(false);
    });
  });

  test.each(['client', 'agent'])('preserves interventions and their history in More for %s', async (role) => {
    const account = { ...mockUser, role, countryId: 1 };
    getLocalUser.mockReturnValue(account); me.mockResolvedValue({ user: account });
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'nav.openMoreMenu' }));
    const panel = await screen.findByRole('dialog', { name: 'nav.menu' });
    expect(within(panel).getByRole('link', { name: 'nav.interventions' })).toHaveAttribute('href', '/tasks');
    const extraLinks = { client: [['propertySimple.mine', '/properties']], agent: [['roleViews.supervised', '/missions/mine']], admin: [] };
    extraLinks[role].forEach(([name, path]) => expect(within(panel).getByRole('link', { name })).toHaveAttribute('href', path));
  });

  test('makes the dossier hub reachable for clients', async () => {
    const account = { ...mockUser, role: 'client', countryId: 1 };
    getLocalUser.mockReturnValue(account); me.mockResolvedValue({ user: account });
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'nav.openMoreMenu' }));
    const panel = await screen.findByRole('dialog', { name: 'nav.menu' });
    expect(within(panel).getByRole('link', { name: 'dossierHub.title' })).toHaveAttribute('href', '/dossiers');
  });

  test("unifies provider work in one link on desktop and mobile", async () => {
    const providerUser = { ...mockUser, role: "provider" };
    getLocalUser.mockReturnValue(providerUser);
    me.mockResolvedValue({ user: providerUser });

    render(<NavBar />);

    const links = await screen.findAllByRole("link", { name: "providerWorkspace.title" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/prestataire/interventions"));
    expect(screen.queryByRole('link', { name: 'nav.myRides' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.myDeliveries' })).not.toBeInTheDocument();
  });

  test("keeps the coordination centre directly accessible for admins on desktop and mobile", async () => {
    const adminUser = { ...mockUser, role: "admin", countryId: 1 };
    getLocalUser.mockReturnValue(adminUser);
    me.mockResolvedValue({ user: adminUser });
    render(<NavBar />);
    const links = await screen.findAllByRole("link", { name: "nav.home" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", expect.stringMatching(/^\/operations(?:\?|$)/)));
  });

  test.each(['client', 'agent', 'provider', 'admin'])('keeps one named centre for %s and opening it does not mark everything read', async (role) => {
    const account = { ...mockUser, role };
    getLocalUser.mockReturnValue(account); me.mockResolvedValue({ user: account });
    getNotificationSummary.mockResolvedValue({ unread: 3, byProgress: {} });
    render(<NavBar />);
    const links = await screen.findAllByRole('link', { name: 'workspaceQueue.information' });
    const shortcut = links.find((link) => link.getAttribute('href') === '/operations?vue=a-lire');
    expect(shortcut).toBeDefined();
    shortcut.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(shortcut);
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'nav.notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.activities' })).not.toBeInTheDocument();
  });

  test("keeps client technical objects out of the navigation", async () => {
    render(<NavBar />);

    fireEvent.click(screen.getByRole("button", { name: "nav.openMoreMenu" }));
    const panel = await screen.findByRole("dialog", { name: "nav.menu" });

    expect(within(panel).queryByRole("link", { name: "nav.myRides" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "nav.myDeliveries" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "nav.services" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "nav.tasks" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "nav.transactions" })).not.toBeInTheDocument();
  });
});
