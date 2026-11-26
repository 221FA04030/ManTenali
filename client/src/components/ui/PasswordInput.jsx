import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from './Input.jsx';

/**
 * Password field with a "Show password" button, so people can check what they
 * typed on a small phone keyboard. Works with react-hook-form's register().
 */
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const label = visible ? t('auth.hidePassword') : t('auth.showPassword');
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-xl text-ink-muted hover:text-ink"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      }
    />
  );
});
