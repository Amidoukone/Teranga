import { render, screen } from '@testing-library/react';
import RequestAmounts from './RequestAmounts';
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));

test('an estimate is not converted into an agreed price or a fabricated remaining amount', () => {
  render(<RequestAmounts request={{ budget: 100, currency: 'GHS', paymentState: { recordedPayments: 20, agreedAmount: null, remainingAmount: null } }} />);
  expect(screen.getByText('100 GHS')).toBeInTheDocument();
  expect(screen.getByText('20 GHS')).toBeInTheDocument();
  expect(screen.queryByText('requestAmounts.agreed')).not.toBeInTheDocument();
  expect(screen.queryByText('requestAmounts.remaining')).not.toBeInTheDocument();
  expect(screen.queryByText('80 GHS')).not.toBeInTheDocument();
});

test('falls back to XOF instead of showing an amount with no currency unit', () => {
  render(<RequestAmounts request={{ budget: 100, currency: '', paymentState: { recordedPayments: 20 } }} />);
  expect(screen.getByText('100 XOF')).toBeInTheDocument();
  expect(screen.getByText('20 XOF')).toBeInTheDocument();
});

test('the courier declaration remains separate from recorded payments and the remaining balance', () => {
  render(<RequestAmounts request={{ budget: 100, currency: 'XOF', collectedAmount: 40, paymentState: { recordedPayments: 20, agreedAmount: 100, remainingAmount: 80 } }} />);
  expect(screen.getByText('transportWorkspace.collectedRecorded')).toBeInTheDocument();
  expect(screen.getByText('40 XOF')).toBeInTheDocument();
  expect(screen.getByText('20 XOF')).toBeInTheDocument();
  expect(screen.getByText('80 XOF')).toBeInTheDocument();
  expect(screen.queryByText('60 XOF')).not.toBeInTheDocument();
});
