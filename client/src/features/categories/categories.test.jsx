import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';
import { useCategories, categoryName } from './api.js';
import { categoryIcon } from '../../lib/categoryIcons.js';
import { Tag, Cake } from 'lucide-react';

function List({ type }) {
  const { data, isPending, isError } = useCategories(type);
  if (isPending) return <p>loading</p>;
  if (isError) return <p>error</p>;
  return (
    <ul>
      {data.map((c) => (
        <li key={c.id}>{categoryName(c, 'te')}</li>
      ))}
    </ul>
  );
}

describe('categories', () => {
  it('loads categories of a type and shows Telugu names with English fallback', async () => {
    const { calls } = mockApi({
      'GET /categories': () =>
        ok([
          { id: '1', name: { en: 'Restaurants', te: 'రెస్టారెంట్లు' }, slug: 'restaurants', type: 'business', icon: 'utensils' },
          { id: '2', name: { en: 'Tailoring', te: null }, slug: 'tailoring', type: 'business', icon: 'scissors' },
        ]),
    });
    renderWithProviders(<List type="business" />);
    expect(await screen.findByText('రెస్టారెంట్లు')).toBeInTheDocument();
    expect(screen.getByText('Tailoring')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/categories').query).toEqual({ type: 'business' });
  });

  it('maps icon keys with a safe fallback', () => {
    expect(categoryIcon('cake')).toBe(Cake);
    expect(categoryIcon('unknown-key')).toBe(Tag);
  });
});
