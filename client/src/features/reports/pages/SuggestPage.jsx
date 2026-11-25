import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, CheckCircle2, Lightbulb, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { MIN_DETAILS, SUGGESTION_REASONS, useCreateReport } from '../api.js';

/**
 * /suggest - the centre "Suggest" button (decision U1 / D0.13). Owners list their
 * own business and organisers submit events through the existing flows; anything
 * else (a missing business, a correction, an idea) is sent to admins as a suggestion.
 */
export default function SuggestPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [reason, setReason] = useState('new_business');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const mutation = useCreateReport({
    onSuccess: () => {
      setSent(true);
      setDetails('');
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });

  return (
    <>
      <PageHeader title={t('pages.suggest')} />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[15px] text-ink-muted">{t('suggest.intro')}</p>
        <ul className="flex flex-col gap-3">
          <li>
            <ListRow icon={Store} title={t('suggest.ownBusiness')} subtitle={t('suggest.ownBusinessHint')} to="/manage/new" />
          </li>
          <li>
            <ListRow icon={CalendarPlus} title={t('suggest.event')} subtitle={t('suggest.eventHint')} to="/events/submit" />
          </li>
        </ul>

        <Card className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Lightbulb className="h-5 w-5 text-brand-700" aria-hidden="true" /> {t('suggest.formTitle')}
          </h2>
          {sent ? (
            <div role="status" className="flex flex-col items-start gap-3">
              <p className="flex items-center gap-2 font-semibold text-brand-800">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t('suggest.thanks')}
              </p>
              <Button variant="secondary" onClick={() => setSent(false)}>
                {t('suggest.another')}
              </Button>
            </div>
          ) : !user ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t('suggest.loginNeeded')}</p>
              <Link to="/login?next=%2Fsuggest" className="inline-flex min-h-tap items-center justify-center rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">
                {t('auth.login')}
              </Link>
            </div>
          ) : (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (details.trim().length < MIN_DETAILS) return setError(true);
                setError(false);
                mutation.mutate({ targetType: 'suggestion', reason, details: details.trim() });
                return undefined;
              }}
            >
              <Input as="select" label={t('suggest.kind')} value={reason} onChange={(e) => setReason(e.target.value)}>
                {SUGGESTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`suggest.kinds.${r}`)}
                  </option>
                ))}
              </Input>
              <Input
                as="textarea"
                label={`${t('suggest.details')} *`}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                hint={t(`suggest.hints.${reason}`)}
                error={error ? t('report.detailsRequired', { min: MIN_DETAILS }) : undefined}
              />
              <Button type="submit" loading={mutation.isPending} fullWidth>
                {t('suggest.send')}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
