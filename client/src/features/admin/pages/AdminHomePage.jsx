import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, ClipboardCheck, FolderTree, Store } from 'lucide-react';
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
          <ListRow icon={ClipboardCheck} title={t('review.title')} subtitle={t('review.hint')} to="/admin/submissions" />
        </li>
        <li>
          <ListRow icon={Store} title={t('admin.businesses')} subtitle={t('admin.businessesHint')} to="/admin/businesses" />
        </li>
        <li>
          <ListRow icon={CalendarCheck} title={t('eventReview.title')} subtitle={t('eventReview.hint')} to="/admin/event-submissions" />
        </li>
        <li>
          <ListRow icon={CalendarDays} title={t('eventAdmin.title')} subtitle={t('eventAdmin.hint')} to="/admin/events" />
        </li>
        <li>
          <ListRow icon={FolderTree} title={t('categoriesAdmin.title')} subtitle={t('categoriesAdmin.hint')} to="/admin/categories" />
        </li>
      </ul>
    </>
  );
}
