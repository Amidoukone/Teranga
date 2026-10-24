import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceTasksPage from './ServiceTasksPage';

const mockNavigate = jest.fn();
const mockLocation = { search: '?etape=27&pieces=1', state: { from: '/operations?vue=a-lire' } };
let mockContext, mockViewer;
jest.mock('react-router-dom', () => ({ useParams: () => ({ id: '14' }), useLocation: () => mockLocation, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('react-i18next', () => { const t = (key) => key; return { useTranslation: () => ({ t }) }; });
jest.mock('../features/service-workspace/ServiceStepsPanel', () => ({ onContext }) => <button type="button" onClick={() => onContext(mockContext, mockViewer)}>Contexte vérifié au serveur</button>);
beforeEach(() => { jest.clearAllMocks(); mockContext = { id: 14 }; mockViewer = { id: 7, role: 'agent' }; });

test('a step update opens its authorized service and files while retaining the operations return link', () => {
  render(<ServiceTasksPage />); userEvent.click(screen.getByRole('button'));
  expect(mockNavigate).toHaveBeenCalledWith('/services/14?etape=27&pieces=1#steps', { replace: true, state: mockLocation.state });
});
test('task-only access stays in the restricted entry instead of opening a forbidden parent', () => {
  mockContext = null; render(<ServiceTasksPage />); userEvent.click(screen.getByRole('button')); expect(mockNavigate).not.toHaveBeenCalled();
});
test('a client’s nontransport mission uses its tracking case', () => {
  mockContext = { id: 14, missionStatus: 'IN_PROGRESS', tradeCategory: { slug: 'administratif' } }; mockViewer.role = 'client';
  render(<ServiceTasksPage />); userEvent.click(screen.getByRole('button'));
  expect(mockNavigate).toHaveBeenCalledWith('/missions/14/track?etape=27&pieces=1#steps', expect.anything());
});
test('administrative missions and transport keep the entry that exposes their authorized steps', () => {
  mockContext = { id: 14, missionStatus: 'IN_PROGRESS', tradeCategory: { slug: 'mobilite' } }; mockViewer.role = 'admin';
  render(<ServiceTasksPage />); userEvent.click(screen.getByRole('button')); expect(mockNavigate).not.toHaveBeenCalled();
});
