import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Home from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

afterEach(cleanup);

it('renders the NOVA landing page', () => {
  render(<Home />);
  expect(
    screen.getByRole('heading', { name: /Parlez-moi de votre situation/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Écrire à NOVA/i }),
  ).toHaveAttribute('href', '/chat');
});

it('routes the voice and partner entry points to existing features', () => {
  render(<Home />);
  expect(
    screen.getByRole('link', { name: /Parler à NOVA/i }),
  ).toHaveAttribute('href', '/voice');
  expect(
    screen.getByRole('link', { name: /Importer mon contrat/i }),
  ).toHaveAttribute('href', '/chat');
  expect(
    screen.getByRole('link', { name: /Je viens d’un partenaire/i }),
  ).toHaveAttribute('href', '/broker');
});
