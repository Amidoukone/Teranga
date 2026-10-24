import { render, screen } from '@testing-library/react';
import RequestProgress from './RequestProgress';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

test('completed work still awaits review and becomes finished only after validation', () => {
  const { rerender } = render(<RequestProgress request={{ status: 'completed' }} />);
  expect(screen.getByRole('listitem', { name: 'requestProgress.review' })).toHaveAttribute('aria-current', 'step');
  rerender(<RequestProgress request={{ missionStatus: 'VALIDATED' }} />);
  expect(screen.getByRole('listitem', { name: 'requestProgress.finished' })).toHaveAttribute('aria-current', 'step');
  rerender(<RequestProgress request={{ missionStatus: 'CANCELLED_BY_CLIENT' }} />);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('serviceOrders.clientNextAction.cancelled');
});
