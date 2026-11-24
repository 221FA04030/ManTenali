import { Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** "Mana Tenali" wordmark with the leaf accent from the UI reference. */
export function Logo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center text-white">
      <span className="relative inline-block">
        <Leaf
          className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 fill-brand-300 text-brand-300"
          aria-hidden="true"
        />
        <span className="text-[26px] font-bold leading-tight tracking-tight drop-shadow-sm sm:text-3xl">
          {t('app.name')}
        </span>
      </span>
      <span className="mt-0.5 text-[13px] font-medium text-white/95">
        {t('app.tagline')} <span aria-hidden="true" className="text-red-400">♥</span>
      </span>
    </div>
  );
}
