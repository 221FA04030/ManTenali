import { useTranslation } from 'react-i18next';

/**
 * Avatar picker. Step 1 shows the current photo only; Step 2 replaces the body
 * with the signed Cloudinary image upload component.
 */
export function AvatarField({ value }) {
  const { t } = useTranslation();
  return (
    <p className="text-sm text-ink-muted">{value ? t('profile.photoSet') : t('profile.photoNone')}</p>
  );
}
