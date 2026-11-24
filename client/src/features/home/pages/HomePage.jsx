import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeHeader } from '../../../components/ui/Header.jsx';
import { SearchBar } from '../../../components/ui/SearchBar.jsx';
import { CategoryTile } from '../../../components/ui/CategoryTile.jsx';
import { HOME_TILES } from '../../../config/navigation.js';

/**
 * Home screen (spec section 11). Step 0: header, search and category tiles.
 * The banner carousel and Today in Tenali come from GET /home in Step 8.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <HomeHeader>
        <SearchBar onSubmit={(q) => navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')} />
      </HomeHeader>

      <section aria-label={t('home.categoriesLabel')} className="page-pad pt-2">
        <ul className="grid grid-cols-4 gap-2.5 sm:gap-3">
          {HOME_TILES.map((tile) => (
            <li key={tile.key}>
              <CategoryTile icon={tile.icon} label={t(tile.labelKey)} to={tile.to} comingSoon={tile.comingSoon} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
