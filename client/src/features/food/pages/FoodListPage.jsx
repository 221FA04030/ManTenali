import { useTranslation } from 'react-i18next';
import { UtensilsCrossed } from 'lucide-react';
import { BusinessDirectory } from '../../businesses/pages/BusinessListPage.jsx';
import { FoodFilters } from '../components/FoodFilters.jsx';

/** /food - food businesses with cuisine, price range and veg-friendly filters (FR-FOOD-1/2). */
export default function FoodListPage() {
  const { t } = useTranslation();
  return (
    <BusinessDirectory
      fixedKind="food"
      title={t('pages.food')}
      emptyIcon={UtensilsCrossed}
      renderFilters={(value, onChange) => <FoodFilters value={value} onChange={onChange} />}
    />
  );
}
