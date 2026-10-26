import { loginDestination } from './loginDestination';
test.each([undefined, null, '', '/dashboard', '/login', '/register', '/reset-password/code', '//example.com/path', '/\\example.com', 'https://example.com', '/orders/12\n'])('default login destination rejects unsafe or obsolete target %s', (from) => {
  expect(loginDestination(from)).toBe('/operations');
});
test('login preserves a requested case, its filters and its section', () => {
  expect(loginDestination({ pathname: '/projects/14', search: '?etape=29', hash: '#project-tasks' })).toBe('/projects/14?etape=29#project-tasks');
  expect(loginDestination('/operations?vue=a-lire')).toBe('/operations?vue=a-lire');
});
