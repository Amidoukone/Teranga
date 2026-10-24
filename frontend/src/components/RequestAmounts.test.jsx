import { render, screen } from '@testing-library/react';
import RequestAmounts from './RequestAmounts';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));

test('an estimate is not converted into an agreed price or a fabricated remaining amount', () => {
  render(<RequestAmounts request={{ budget: 100, currency: 'GHS', paymentState: { recordedPayments: 20, agreedAmount: null, remainingAmount: null } }} />);
  expect(screen.getByText('100 GHS')).toBeInTheDocument();
  expect(screen.getByText('20 GHS')).toBeInTheDocument();
  expect(screen.getByText('requestAmounts.toConfirm')).toBeInTheDocument();
  expect(screen.getByText('requestAmounts.unknown')).toBeInTheDocument();
  expect(screen.queryByText('80 GHS')).not.toBeInTheDocument();
});
