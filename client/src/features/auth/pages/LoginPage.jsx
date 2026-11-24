import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cn } from '../../../lib/cn.js';
import { authApi } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';

/** Only allow same-app relative redirects (prevents open redirects via ?next=). */
export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/profile';
  return value;
}

const loginSchema = z.object({
  email: z.string().trim().email('auth.v.email'),
  password: z.string().min(1, 'auth.v.passwordRequired'),
});
const registerSchema = z.object({
  name: z.string().trim().min(2, 'auth.v.name').max(80, 'auth.v.name'),
  email: z.string().trim().email('auth.v.email'),
  password: z.string().min(8, 'auth.v.passwordLength').max(72, 'auth.v.passwordLength'),
});

function AuthForm({ mode, onSuccess }) {
  const { t } = useTranslation();
  const isRegister = mode === 'register';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(isRegister ? registerSchema : loginSchema), mode: 'onTouched' });

  const mutation = useMutation({
    mutationFn: (values) => (isRegister ? authApi.register(values) : authApi.login(values)),
    onSuccess,
    onError: (err) => {
      const fields = err.fieldErrors ?? {};
      Object.entries(fields).forEach(([field, message]) => setError(field, { message }));
      setError('root', { message: t(err.status === 401 ? 'auth.badCredentials' : errorMessageKey(err)) });
    },
  });

  const fieldError = (name) => {
    const msg = errors[name]?.message;
    return msg ? (msg.startsWith('auth.') ? t(msg) : msg) : undefined;
  };

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="flex flex-col gap-4">
      {isRegister && (
        <Input label={t('auth.name')} autoComplete="name" error={fieldError('name')} {...register('name')} />
      )}
      <Input
        label={t('auth.email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        error={fieldError('email')}
        {...register('email')}
      />
      <Input
        label={t('auth.password')}
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        hint={isRegister ? t('auth.passwordHint') : undefined}
        error={fieldError('password')}
        {...register('password')}
      />
      {errors.root?.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={mutation.isPending}>
        {isRegister ? t('auth.createAccount') : t('auth.login')}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, setSessionUser } = useAuth();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const next = safeNext(params.get('next'));

  const googleMutation = useMutation({
    mutationFn: authApi.google,
    onSuccess: (u) => done(u),
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });

  function done(u) {
    setSessionUser(u);
    toast.success(t('auth.welcome', { name: u.name }));
    navigate(next, { replace: true });
  }

  if (user) return <Navigate to={next} replace />;

  return (
    <>
      <PageHeader title={mode === 'register' ? t('auth.createAccount') : t('auth.login')} />
      <div className="flex flex-col gap-4 p-4">
        <Card className="p-5">
          <div role="tablist" aria-label={t('auth.login')} className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-brand-50 p-1">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-tap rounded-full text-sm font-semibold transition-colors',
                  mode === m ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-muted hover:text-brand-800',
                )}
              >
                {m === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>
          <AuthForm key={mode} mode={mode} onSuccess={done} />
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
                <span className="h-px flex-1 bg-brand-100" />
                {t('auth.or')}
                <span className="h-px flex-1 bg-brand-100" />
              </div>
              <GoogleSignInButton onCredential={(token) => googleMutation.mutate(token)} disabled={googleMutation.isPending} />
            </>
          )}
        </Card>
        <p className="px-2 text-center text-xs text-ink-soft">{t('auth.privacyNote')}</p>
      </div>
    </>
  );
}
