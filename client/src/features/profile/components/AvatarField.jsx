import { useTranslation } from 'react-i18next';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';

/** Profile photo: signed Cloudinary upload; saves the URL on the profile. */
export function AvatarField({ value, onChange, busy }) {
  const { t } = useTranslation();
  return (
    <ImageUpload
      purpose="avatar"
      shape="round"
      value={value}
      disabled={busy}
      alt={t('profile.photo')}
      onChange={(image) => onChange(image?.url ?? null)}
    />
  );
}
