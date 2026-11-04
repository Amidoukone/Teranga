import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PropertiesWorkspace from './PropertiesWorkspace';
import PropertyDetailPage from '../../pages/PropertyDetailPage';
import PropertyEditor from './PropertyEditor';
import { getProperties, getPropertyById, createProperty } from '../../services/properties';
import { me } from '../../services/auth';

const mockNavigate = jest.fn(), mockGeo = { user: { id: 7, role: 'client' }, countryId: 1, regionId: null };
const t = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../../services/auth', () => ({ me: jest.fn() }));
jest.mock('../../services/properties', () => ({ getProperties: jest.fn(), getPropertyById: jest.fn(), createProperty: jest.fn(), deleteProperty: jest.fn() }));
jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), getFileUrl: (path) => path }));
jest.mock('../../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../mission-creation/LocationAutocompleteInput', () => ({ value, onChange }) => <input value={value} onChange={(event) => onChange(event.target.value)} />);
jest.mock('../mission-creation/MissionLocationMap', () => () => <p>Map</p>);
jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>, useNavigate: () => mockNavigate, useParams: () => ({ id: '3' }),
  useLocation: () => ({ pathname: '/properties', search: '', state: { from: '/properties?q=Maison&page=2' } }),
  useSearchParams: () => { const React = require('react'); return React.useState(() => new URLSearchParams('q=Maison&page=2')); },
}), { virtual: true });
const property = { id: 3, ownerId: 7, title: 'Maison familiale', type: 'house', address: 'Rue 1', city: 'Bamako', countryId: 1, createdAt: new Date().toISOString(), photos: ['/uploads/facade.png', '/uploads/titre.pdf'] };
beforeEach(() => { jest.clearAllMocks(); me.mockResolvedValue({ user: mockGeo.user }); getProperties.mockResolvedValue({ items: [property], pagination: { total: 21 } }); getPropertyById.mockResolvedValue(property); createProperty.mockResolvedValue(property); });

test('the property list requests the server page and exposes one main action without opening a creation form', async () => {
  render(<PropertiesWorkspace />); await screen.findByRole('article', { name: 'Maison familiale' });
  expect(getProperties).toHaveBeenCalledWith({ page: 2, limit: 20, q: 'Maison', type: '', countryId: null, regionId: null }, { withPagination: true, strict: true });
  expect(screen.getByRole('link', { name: 'propertySimple.open' })).toHaveAttribute('href', '/properties/3');
  expect(screen.queryByRole('form', { name: 'propertySimple.new' })).not.toBeInTheDocument();
});

test('a property exposes its own documents and a contextual intervention action before loading history', async () => {
  render(<PropertyDetailPage />);
  await screen.findByRole('heading', { name: 'Maison familiale' });
  expect(getPropertyById).toHaveBeenCalledWith('3', { strict: true });
  expect(screen.getByRole('link', { name: 'propertySimple.request' })).toHaveAttribute('href', '/demandes/nouvelle?bien=3');
  expect(screen.getAllByRole('link', { name: 'propertySimple.fileNumber' })).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'propertySimple.back' })).toHaveAttribute('href', '/properties?q=Maison&page=2');
});

test('a failed refresh retains the property while revoked access removes documents and controls', async () => {
  render(<PropertyDetailPage />); await screen.findByRole('heading', { name: 'Maison familiale' });
  getPropertyById.mockRejectedValueOnce({ response: { status: 503 } }); fireEvent(window, new Event('online'));
  await screen.findByRole('alert'); expect(screen.getByRole('heading', { name: 'Maison familiale' })).toBeInTheDocument();
  getPropertyById.mockRejectedValueOnce({ response: { status: 403 } }); fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.retry' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Maison familiale' })).not.toBeInTheDocument());
  expect(screen.queryByRole('link', { name: 'propertySimple.request' })).not.toBeInTheDocument();
});

test('creation keeps the chosen documents and blocks duplicate submissions', async () => {
  let finish; createProperty.mockImplementation(() => new Promise((resolve) => { finish = resolve; })); const onSaved = jest.fn();
  render(<PropertyEditor user={mockGeo.user} onSaved={onSaved} onCancel={jest.fn()} />);
  for (const [key, value] of [['title', 'Ma maison'], ['address', 'Rue 1'], ['city', 'Bamako']]) fireEvent.change(screen.getByLabelText(`propertiesPage.form.labels.${key}`), { target: { value } });
  const file = new File(['receipt'], 'titre.pdf', { type: 'application/pdf' }); fireEvent.change(screen.getByLabelText('propertySimple.files'), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form'));
  expect(createProperty).toHaveBeenCalledTimes(1); expect(createProperty.mock.calls[0][1]).toEqual([file]);
  await act(async () => finish(property)); expect(onSaved).toHaveBeenCalledWith(property);
});

test('a creation refusal preserves the property address and selected file', async () => {
  createProperty.mockRejectedValue({ response: { status: 503, data: { error: 'Stockage indisponible' } } });
  render(<PropertyEditor user={mockGeo.user} onSaved={jest.fn()} onCancel={jest.fn()} />);
  for (const [key, value] of [['title', 'Ma maison'], ['address', 'Rue 1'], ['city', 'Bamako']]) fireEvent.change(screen.getByLabelText(`propertiesPage.form.labels.${key}`), { target: { value } });
  fireEvent.change(screen.getByLabelText('propertySimple.files'), { target: { files: [new File(['photo'], 'facade.png', { type: 'image/png' })] } });
  fireEvent.submit(screen.getByRole('form')); expect(await screen.findByRole('alert')).toHaveTextContent('Stockage indisponible');
  expect(screen.getByLabelText('propertiesPage.form.labels.address')).toHaveValue('Rue 1'); expect(screen.getByText('facade.png')).toBeInTheDocument();
});
