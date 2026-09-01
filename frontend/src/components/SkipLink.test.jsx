import React from 'react';
import { render, screen } from '@testing-library/react';
import SkipLink from './SkipLink';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

test('exposes a keyboard skip link to the main content landmark', () => {
  render(<SkipLink />);
  const link = screen.getByRole('link', { name: 'accessibility.skipToContent' });
  expect(link).toHaveAttribute('href', '#main-content');
  expect(link).toHaveClass('skip-link');
});
