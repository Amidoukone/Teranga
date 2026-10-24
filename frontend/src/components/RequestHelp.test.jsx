import { render, screen } from '@testing-library/react';
import RequestHelp from './RequestHelp';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, values) => key === 'requestHelp.message' ? `Aide pour #${values.id}: ${values.title}` : key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });

test('assistance keeps the request reference and its own country phone', () => {
  const { rerender } = render(<RequestHelp id={12} title="Réparer une fuite" phone="+2250700000000" />);
  expect(screen.getByRole('link', { name: 'requestHelp.call' })).toHaveAttribute('href', 'tel:+2250700000000');
  const whatsapp = new URL(screen.getByRole('link', { name: 'requestHelp.whatsapp' }).href);
  expect(whatsapp.searchParams.get('text')).toBe('Aide pour #12: Réparer une fuite');
  rerender(<RequestHelp id={12} />);
  expect(screen.queryByRole('link', { name: 'requestHelp.call' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'requestHelp.options' })).toHaveAttribute('href', '/help-support?demande=12');
});
