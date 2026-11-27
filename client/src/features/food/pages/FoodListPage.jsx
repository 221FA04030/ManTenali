import { useTranslation } from 'react-i18next';
import { UtensilsCrossed } from 'lucide-react';
import { BusinessDirectory } from '../../businesses/pages/BusinessListPage.jsx';
import { FoodCuisineRow, useFoodSheetFilters } from '../components/FoodFilters.jsx';

/** /food - food businesses with cuisine chips; price range and veg-friendly in the Filters sheet (FR-FOOD-1/2). */
export default function FoodListPage() {
  const { t } = useTranslation();
  const sheetExtras = useFoodSheetFilters();
  return (
    <BusinessDirectory
      fixedKind="food"
      title={t('pages.food')}
      intro={t('intro.food')}
      emptyIcon={UtensilsCrossed}
      renderPrimary={(value, onChange) => <FoodCuisineRow value={value} onChange={onChange} />}
      sheetExtras={sheetExtras}
    />
  );
}
