import { render, screen } from "@testing-library/react";
import ClientRequestCard from "./ClientRequestCard";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }) }));
jest.mock("../i18n/useLocale", () => ({ useLocale: () => ({ formatDate: (value) => `date:${value}` }) }));
jest.mock("./RequestSummaryCard", () => (props) => <div data-testid="request-summary-card" data-request-id={props.request.id} data-from={props.from} />);

test("delegates service requests to the shared summary card", () => {
  render(<ClientRequestCard request={{ kind: "service", id: 9 }} from="/operations" />);
  const summary = screen.getByTestId("request-summary-card");
  expect(summary).toHaveAttribute("data-request-id", "9");
  expect(summary).toHaveAttribute("data-from", "/operations");
});

test("links a project request to its project route and keeps the back-navigation state", () => {
  render(<ClientRequestCard request={{ kind: "project", id: 4, title: "Rénovation", status: "in_progress" }} from="/operations?vue=a-suivre" />);
  const link = screen.getByRole("link", { name: "serviceOrders.follow" });
  expect(link).toHaveAttribute("href", "/projects/4");
});

test("links an order request to its order route and shows its payment status", () => {
  render(<ClientRequestCard request={{ kind: "order", id: 11, status: "processing", paymentStatus: "paid" }} from="/operations" />);
  expect(screen.getByRole("link", { name: "serviceOrders.follow" })).toHaveAttribute("href", "/orders/11");
  expect(screen.getByText((_, el) => el.textContent === "orders.list.paymentStatusLabel paid")).toBeInTheDocument();
});

test("never shows a payment status line for a project", () => {
  render(<ClientRequestCard request={{ kind: "project", id: 4, status: "in_progress", paymentStatus: "paid" }} from="/operations" />);
  expect(screen.queryByText(/orders.list.paymentStatusLabel/)).not.toBeInTheDocument();
});

test("flags a request awaiting the client's review distinctly from a closed one", () => {
  const { rerender } = render(<ClientRequestCard request={{ kind: "project", id: 4, status: "completed", review: true }} from="/operations" />);
  expect(screen.getByRole("link", { name: "clientHome.review" })).toBeInTheDocument();
  expect(screen.getByText("unifiedRequests.next.review")).toBeInTheDocument();

  rerender(<ClientRequestCard request={{ kind: "project", id: 4, status: "completed", history: true }} from="/operations" />);
  expect(screen.getByRole("link", { name: "serviceOrders.view" })).toBeInTheDocument();
  expect(screen.getByText("unifiedRequests.next.closed")).toBeInTheDocument();
});

test("renders the executor and formatted creation date when available", () => {
  render(<ClientRequestCard request={{ kind: "order", id: 2, status: "processing", executor: "Fatou Diop", createdAt: "2026-10-01" }} from="/operations" />);
  expect(screen.getByText("Fatou Diop")).toBeInTheDocument();
  expect(screen.getByText("date:2026-10-01")).toBeInTheDocument();
});
