import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bookmark, LogOut, Plus, ShieldCheck, Star, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { TENALI_AREAS } from '../../../config/areas.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { authApi } from '../../auth/api.js';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { AvatarField } from '../components/AvatarField.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';

const schema = z.object({
  name: z.string().trim().min(2, 'auth.v.name').max(80, 'auth.v.name'),
  preferredArea: z.string().max(80),
  language: z.enum(['en', 'te']),
});

export function Avatar({ user, size = 'h-16 w-16 text-xl' }) {
  if (user.avatarUrl) {
    return <img src={cldUrl(user.avatarUrl, { w: 128, h: 128 })} alt="" className={`${size} rounded-full object-cover ring-4 ring-white`} />;
  }
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={`${size} flex items-center justify-center rounded-full bg-brand-700 font-bold text-white ring-4 ring-white`}>
      {initials}
    </span>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, setSessionUser, logout } = useAuth();
  const { setArea } = useLocationContext();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, preferredArea: user.preferredArea ?? '', language: user.language },
  });

  const mutation = useMutation({
    mutationFn: (values) => authApi.updateMe({ ...values, preferredArea: values.preferredArea || null }),
    onSuccess: (updated) => {
      setSessionUser(updated);
      if (updated.preferredArea) setArea(updated.preferredArea);
      reset({ name: updated.name, preferredArea: updated.preferredArea ?? '', language: updated.language });
      toast.success(t('profile.saved'));
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });

  const avatarMutation = useMutation({
    mutationFn: (avatarUrl) => authApi.updateMe({ avatarUrl }),
    onSuccess: (updated) => {
      setSessionUser(updated);
      toast.success(t('profile.saved'));
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });

  const err = (name) => (errors[name]?.message ? t(errors[name].message) : undefined);

  return (
    <>
      <PageHeader title={t('pages.profile')} back={false} />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex items-center gap-4">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{user.name}</p>
            {user.email && <p className="truncate text-sm text-ink-muted">{user.email}</p>}
            {user.role !== 'user' && (
              <Badge tone="solid" className="mt-1">
                {t(`roles.${user.role}`)}
              </Badge>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold">{t('profile.photo')}</h2>
          <AvatarField
            value={user.avatarUrl}
            onChange={(url) => avatarMutation.mutate(url)}
            busy={avatarMutation.isPending}
          />
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold">{t('profile.details')}</h2>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
            <Input label={t('auth.name')} autoComplete="name" error={err('name')} {...register('name')} />
            <Input as="select" label={t('profile.area')} hint={t('profile.areaHint')} {...register('preferredArea')}>
              <option value="">{t('profile.noArea')}</option>
              {TENALI_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Input>
            <Input as="select" label={t('menu.language')} {...register('language')}>
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
            </Input>
            <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
              {t('common.save')}
            </Button>
          </form>
        </Card>

        <ul className="flex flex-col gap-3">
          <li>
            <ListRow icon={Bookmark} title={t('profile.saved')} subtitle={t('profile.savedHint')} to="/saved" iconSize="md" />
          </li>
          <li>
            <ListRow icon={Star} title={t('profile.myReviews')} subtitle={t('profile.myReviewsHint')} to="/profile/reviews" iconSize="md" />
          </li>
          <li>
            <ListRow icon={Plus} title={t('submit.addYourBusiness')} subtitle={t('submit.addHint')} to="/manage/new" iconSize="md" />
          </li>
          <li>
            <ListRow icon={Store} title={t('profile.myBusinesses')} subtitle={t('submit.myBusinessesHint')} to="/manage" iconSize="md" />
          </li>
          {user.role === 'admin' && (
            <li>
              <ListRow icon={ShieldCheck} title={t('menu.admin')} subtitle={t('profile.adminHint')} to="/admin" iconSize="md" />
            </li>
          )}
        </ul>

        <Button variant="secondary" onClick={logout} fullWidth>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('menu.logout')}
        </Button>
        <p className="text-center text-xs text-ink-soft">{t('profile.deleteNote')}</p>
        <Link to="/about" className="text-center text-xs text-brand-700 underline">
          {t('menu.about')}
        </Link>
      </div>
    </>
  );
}
