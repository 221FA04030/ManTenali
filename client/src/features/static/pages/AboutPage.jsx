import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.about')} />
      <div className="p-4">
        <Card>
          <h2 className="mb-2 text-lg font-bold">{t('app.name')}</h2>
          <p className="text-[15px] leading-relaxed text-ink-muted">{t('about.body')}</p>
        </Card>
      </div>
    </>
  );
}
