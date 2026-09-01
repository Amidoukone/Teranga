import { fireEvent, render, screen } from '@testing-library/react';

import CategoryPicker from './CategoryPicker';

const labels = {
  'services.type.errand': 'Course / Commission',
  'services.type.administrative': 'Demarche administrative',
  'services.type.payment': 'Paiement',
  'services.type.money_transfer': "Transfert d'argent",
  'services.type.other': 'Autre service',
};

jest.mock('react-i18next', () => {
  const localLabels = {
    'services.type.errand': 'Course / Commission',
    'services.type.administrative': 'Demarche administrative',
    'services.type.payment': 'Paiement',
    'services.type.money_transfer': "Transfert d'argent",
    'services.type.other': 'Autre service',
  };
  const t = (key) => localLabels[key] || key;
  return { useTranslation: () => ({ t }) };
});

describe('CategoryPicker service search', () => {
  const categories = [
    { id: 1, name: 'Taxi', slug: 'mobilite' },
    { id: 2, name: 'Electricite', slug: 'electricite' },
    { id: 3, name: 'Livraison', slug: 'livraison' },
  ];

  test('filters trade and classic offers with plain-language search', () => {
    render(
      <CategoryPicker
        tradeCategories={categories}
        value={{ requestKind: null }}
        onChange={jest.fn()}
      />
    );

    const search = screen.getByRole('searchbox', { name: 'missionCreation.categorySearch.label' });
    fireEvent.change(search, { target: { value: 'taxi' } });
    expect(screen.getByRole('button', { name: 'Taxi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Livraison' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'paiement' } });
    expect(screen.getByRole('button', { name: labels['services.type.payment'] })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Taxi' })).not.toBeInTheDocument();
  });

  test('shows an explicit empty result message', () => {
    render(
      <CategoryPicker
        tradeCategories={categories}
        value={{ requestKind: null }}
        onChange={jest.fn()}
      />
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistant' } });
    expect(screen.getByRole('status')).toHaveTextContent('missionCreation.categorySearch.empty');
  });
});
