import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';
import { EXPLORE_ROWS } from '../../../config/navigation.js';

/** Explore Tenali: Phase 1 sections active, later phases dimmed "Coming soon". */
export default function ExplorePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-full bg-explore-mint">
      <PageHeader variant="mint" title={t('explore.title')} subtitle={t('explore.subtitle')} />
      <ul className="flex flex-col gap-3 px-4 pb-6 pt-2">
        {EXPLORE_ROWS.map((row) => (
          <li key={row.key}>
            <ListRow
              icon={row.icon}
              title={t(row.titleKey)}
              subtitle={t(row.subtitleKey)}
              to={row.to}
              comingSoon={row.comingSoon}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
