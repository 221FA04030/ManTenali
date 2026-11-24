import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';

/** /admin - entry point to admin tools. Sections are added as each step ships. */
export default function AdminHomePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.admin')} />
      <ul className="flex flex-col gap-3 p-4">
        <li>
          <ListRow icon={Store} title={t('admin.businesses')} subtitle={t('admin.businessesHint')} to="/admin/businesses" />
        </li>
      </ul>
    </>
  );
}
