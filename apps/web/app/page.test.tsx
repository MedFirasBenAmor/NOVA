import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Home from './page';

it('renders the NOVA landing page', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: 'NOVA' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open nova chat/i })).toHaveAttribute(
    'href',
    '/chat',
  );
});
