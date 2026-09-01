import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import DossiersPage from './DossiersPage';
import { getProjects } from '../services/projects';
import { getProperties } from '../services/properties';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('react-i18next', () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock('../services/projects', () => ({ getProjects: jest.fn() }));
jest.mock('../services/properties', () => ({ getProperties: jest.fn() }));

describe('DossiersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProjects.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    getProperties.mockResolvedValue([{ id: 10 }]);
  });

  test('groups property and project families without removing their routes', async () => {
    render(<DossiersPage />);

    expect(await screen.findByRole('link', { name: 'dossierHub.properties.action' })).toHaveAttribute(
      'href',
      '/properties'
    );
    expect(screen.getByRole('link', { name: 'dossierHub.projects.action' })).toHaveAttribute(
      'href',
      '/projects'
    );
    expect(screen.getByLabelText('dossierHub.properties.title: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('dossierHub.projects.title: 2')).toBeInTheDocument();
    expect(getProjects).toHaveBeenCalledWith({});
    expect(getProperties).toHaveBeenCalledTimes(1);
  });

  test('offers a retry when the summary cannot be loaded', async () => {
    getProjects.mockRejectedValueOnce(new Error('offline'));
    render(<DossiersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('dossierHub.loadError');
    fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.retry' }));

    await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('link', { name: 'dossierHub.projects.action' })).toBeInTheDocument();
  });
});
