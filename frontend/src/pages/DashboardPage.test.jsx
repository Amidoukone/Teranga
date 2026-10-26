import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
jest.mock('react-router-dom', () => ({ Navigate: ({ to, replace }) => <div data-testid="destination" data-to={to} data-replace={replace} /> }), { virtual: true });
test('an old dashboard bookmark opens the unified home without another role dashboard', () => {
  render(<DashboardPage />);
  expect(screen.getByTestId('destination')).toHaveAttribute('data-to', '/operations');
  expect(screen.getByTestId('destination')).toHaveAttribute('data-replace', 'true');
});