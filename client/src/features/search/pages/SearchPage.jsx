import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderTree, Search, SearchX, Sparkles, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { SearchBar } from '../../../components/ui/SearchBar.jsx';
import { LocationBar } from '../../../components/ui/LocationBar.jsx';
import { SectionHeader } from '../../../components/ui/SectionHeader.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { categoryName } from '../../categories/api.js';
import { ResultCard } from '../components/ResultCard.jsx';
import { MIN_QUERY, RESULT_TYPES, SEARCH_TABS, useSearch, useSuggest } from '../api.js';

const NEAR_ME_KM = 10;

/** Business category suggestion -> filtered business list. */
const categoryLink = (c) => `/businesses?${c.parentId ? `subcategoryId=${c.id}` : `categoryId=${c.id}`}`;

function Suggestions({ text, onPick }) {
  const { t, i18n } = useTranslation();
  const { data } = useSuggest(text);
  const businesses = data?.businesses ?? [];
  const categories = data?.categories ?? [];
  if (!businesses.length && !categories.length) return null;
  const row = 'flex min-h-tap items-center gap-3 px-4 py-2 text-[15px] hover:bg-brand-50';
  return (
    <nav aria-label={t('search.suggestions')} className="overflow-hidden rounded-card bg-white shadow-card ring-1 ring-brand-100">
      <ul className="divide-y divide-brand-100">
        {categories.map((c) => (
          <li key={`c-${c.id}`}>
            <Link to={categoryLink(c)} className={row} onClick={onPick}>
              <FolderTree className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{categoryName(c, i18n.language)}</span>
              <span className="text-xs text-ink-soft">{t('search.suggestCategory')}</span>
            </Link>
          </li>
        ))}
        {businesses.map((b) => (
          <li key={`b-${b.id}`}>
            <Link to={`/businesses/${b.slug}`} className={row} onClick={onPick}>
              <Store className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.area && <span className="text-xs text-ink-soft">{b.area}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** /search - one box across businesses, offers, events and news (FR-SRCH-1/2/3). */
export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { area, coords } = useLocationContext();
  const q = (searchParams.get('q') ?? '').trim();
  const rawType = searchParams.get('type');
  const type = SEARCH_TABS.some((x) => x.key === rawType) ? rawType : 'all';
  const sort = coords && searchParams.get('sort') === 'distance' ? 'distance' : 'relevance';
  const [typed, setTyped] = useState(q);

  const params = useMemo(() => {
    const p = { q, type };
    if (coords) Object.assign(p, { lat: coords.lat, lng: coords.lng, radiusKm: NEAR_ME_KM, sort });
    else if (area) p.area = area;
    return p;
  }, [q, type, coords, area, sort]);
  const query = useSearch(params);
  const pages = query.data?.pages ?? [];
  const first = pages[0]?.data;
  const counts = first?.counts;

  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || (k === 'type' && v === 'all') || (k === 'sort' && v === 'relevance')) next.delete(k);
      else next.set(k, v);
    }
    // A new query is a new history entry (Back returns to it); tab and sort changes replace it.
    setSearchParams(next, { replace: !('q' in patch) });
  };

  const tooShort = q.length > 0 && q.length < MIN_QUERY;
  const showSuggestions = typed.trim().length >= MIN_QUERY && typed.trim() !== q;
  const items = type === 'all' ? [] : pages.flatMap((pg) => pg.data.groups[type] ?? []);

  return (
    <>
      <PageHeader title={t('pages.search')} />
      <div className="flex flex-col gap-4 p-4">
        <SearchBar
          key={q}
          defaultValue={q}
          autoFocus={!q}
          onChange={setTyped}
          onSubmit={(value) => {
            setTyped(value);
            update({ q: value });
          }}
        />
        {showSuggestions && <Suggestions text={typed} onPick={() => setTyped(q)} />}
        <LocationBar />

        {!q ? (
          <EmptyState icon={Search} title={t('search.startTitle')} body={t('search.startBody')} />
        ) : tooShort ? (
          <EmptyState icon={Search} title={t('search.tooShortTitle')} body={t('search.tooShortBody', { min: MIN_QUERY })} />
        ) : (
          <>
            <div role="group" aria-label={t('search.typeLabel')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {SEARCH_TABS.map(({ key, icon: Icon }) => (
                <button key={key} type="button" className={`${chip(type === key)} gap-1.5`} aria-pressed={type === key} onClick={() => update({ type: key })}>
                  {key !== 'all' && <Icon className="h-4 w-4" aria-hidden="true" />}
                  {/* One text node, so the accessible name is "All (9)", not "All(9)". */}
                  <span className="tabular-nums">{counts ? `${t(`search.tabs.${key}`)} (${counts[key]})` : t(`search.tabs.${key}`)}</span>
                </button>
              ))}
            </div>
            {coords && (
              <Input as="select" aria-label={t('search.sortLabel')} value={sort} onChange={(e) => update({ sort: e.target.value })}>
                <option value="relevance">{t('search.sort.relevance')}</option>
                <option value="distance">{t('search.sort.distance')}</option>
              </Input>
            )}

            {query.isPending ? (
              <ListSkeleton rows={4} />
            ) : query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : counts?.[type === 'all' ? 'all' : type] === 0 ? (
              <EmptyState icon={SearchX} title={t('search.noResultsTitle', { q })} body={t('search.noResultsBody')} />
            ) : (
              <>
                {first.fuzzy && (
                  <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('search.fuzzy', { q })}
                  </p>
                )}
                {type === 'all' ? (
                  RESULT_TYPES.filter((rt) => counts[rt] > 0).map((rt) => (
                    <section key={rt} aria-labelledby={`results-${rt}`}>
                      <div id={`results-${rt}`}>
                        <SectionHeader title={t(`search.groups.${rt}`, { count: counts[rt] })} />
                      </div>
                      <ul className="flex flex-col gap-3">
                        {(first.groups[rt] ?? []).map((item) => (
                          <li key={item.id}>
                            <ResultCard type={rt} item={item} />
                          </li>
                        ))}
                      </ul>
                      {counts[rt] > (first.groups[rt] ?? []).length && (
                        <Button variant="secondary" fullWidth className="mt-3" onClick={() => update({ type: rt })}>
                          {t(`search.seeAll.${rt}`, { count: counts[rt] })}
                        </Button>
                      )}
                    </section>
                  ))
                ) : (
                  <>
                    <p className="text-sm text-ink-muted" aria-live="polite">
                      {t('search.resultCount', { count: counts[type] })}
                      {pages[0]?.meta?.capped && ` ${t('search.capped')}`}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {items.map((item) => (
                        <li key={item.id}>
                          <ResultCard type={type} item={item} />
                        </li>
                      ))}
                    </ul>
                    {query.hasNextPage && (
                      <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage} fullWidth>
                        {t('common.loadMore')}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
