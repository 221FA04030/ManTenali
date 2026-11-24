/**
 * Reference categories for Tenali (FR-CAT-1). Admins can rename, reorder or
 * deactivate them later; re-running the seed never overwrites those edits.
 * Icon keys are mapped to icons by the client.
 */
const business = [
  ['grocery-kirana', 'Grocery & Kirana', 'కిరాణా & సరుకులు', 'shopping-basket'],
  ['clothing-textiles', 'Clothing & Textiles', 'బట్టలు & వస్త్రాలు', 'shirt'],
  ['jewellery', 'Jewellery', 'నగలు', 'gem'],
  ['electronics-mobiles', 'Electronics & Mobiles', 'ఎలక్ట్రానిక్స్ & మొబైల్స్', 'smartphone'],
  ['hardware-building', 'Hardware & Building Materials', 'హార్డ్‌వేర్ & నిర్మాణ సామగ్రి', 'hammer'],
  ['books-stationery', 'Books & Stationery', 'పుస్తకాలు & స్టేషనరీ', 'book-open'],
  ['restaurants', 'Restaurants', 'రెస్టారెంట్లు', 'utensils'],
  ['tiffin-centres', 'Tiffin Centres', 'టిఫిన్ సెంటర్లు', 'coffee'],
  ['sweets-bakery', 'Sweets & Bakery', 'స్వీట్స్ & బేకరీ', 'cake'],
  ['cafes-juice', 'Cafés & Juice Shops', 'కేఫ్‌లు & జ్యూస్ షాపులు', 'cup-soda'],
  ['tailoring', 'Tailoring', 'టైలరింగ్', 'scissors'],
  ['salons-beauty', 'Salons & Beauty', 'సెలూన్లు & బ్యూటీ', 'sparkles'],
  ['repairs', 'Repairs & Servicing', 'రిపేర్లు & సర్వీసింగ్', 'wrench'],
  ['electricians-plumbers', 'Electricians & Plumbers', 'ఎలక్ట్రీషియన్లు & ప్లంబర్లు', 'plug'],
];

const event = [
  ['festivals-culture', 'Festivals & Culture', 'పండుగలు & సంస్కృతి', 'sparkles'],
  ['religious', 'Religious', 'ఆధ్యాత్మికం', 'landmark'],
  ['fairs-exhibitions', 'Fairs & Exhibitions', 'జాతరలు & ప్రదర్శనలు', 'tent'],
  ['music-drama', 'Music & Drama', 'సంగీతం & నాటకం', 'music'],
  ['sports', 'Sports', 'క్రీడలు', 'trophy'],
  ['workshops', 'Workshops & Learning', 'వర్క్‌షాప్‌లు & శిక్షణ', 'graduation-cap'],
  ['community', 'Community', 'సమాజం', 'users'],
];

const news = [
  ['civic', 'Civic & Municipal', 'పౌర & మున్సిపల్', 'landmark'],
  ['local-business', 'Local Business', 'స్థానిక వ్యాపారం', 'store'],
  ['culture', 'Culture', 'సంస్కృతి', 'sparkles'],
  ['sports', 'Sports', 'క్రీడలు', 'trophy'],
  ['education', 'Education', 'విద్య', 'graduation-cap'],
];

const build = (type, rows) =>
  rows.map(([slug, en, te, icon], i) => ({ type, slug, name: { en, te }, icon, sortOrder: (i + 1) * 10 }));

export const CATEGORY_SEED = [...build('business', business), ...build('event', event), ...build('news', news)];
