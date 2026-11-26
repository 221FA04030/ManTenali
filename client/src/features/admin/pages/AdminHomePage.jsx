import { useTranslation } from 'react-i18next';
import { BarChart3, CalendarCheck, CalendarDays, ClipboardCheck, Flag, FolderTree, Newspaper, Store, Users } from 'lucide-react';
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
          <ListRow icon={Flag} title={t('adminReports.title')} subtitle={t('adminReports.hint')} to="/admin/reports" />
        </li>
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
          <ListRow icon={Newspaper} title={t('newsAdmin.title')} subtitle={t('newsAdmin.hint')} to="/admin/news" />
        </li>
        <li>
          <ListRow icon={FolderTree} title={t('categoriesAdmin.title')} subtitle={t('categoriesAdmin.hint')} to="/admin/categories" />
        </li>
        <li>
          <ListRow icon={Users} title={t('adminUsers.title')} subtitle={t('adminUsers.hint')} to="/admin/users" />
        </li>
        <li>
          <ListRow icon={BarChart3} title={t('adminMetrics.title')} subtitle={t('adminMetrics.hint')} to="/admin/metrics" />
        </li>
      </ul>
    </>
  );
}
