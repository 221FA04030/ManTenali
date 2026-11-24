/**
 * Reference categories for Tenali (FR-CAT-1).
 *
 * Business categories have two levels (main category -> subcategory).
 * Subcategories that already existed in the original flat seed keep their
 * slug (marked "existing") and are attached to a main category, so nothing is
 * duplicated and existing business references stay valid.
 * Admins can rename, reorder or deactivate any of these later; re-running the
 * seed never overwrites those edits.
 */
const sub = (slug, en, te, icon) => ({ slug, name: { en, te }, icon });

const tree = [
  {
    slug: 'food-dining', name: { en: 'Food & Dining', te: 'ఆహారం & భోజనం' }, icon: 'utensils',
    children: [
      sub('restaurants', 'Restaurants', 'రెస్టారెంట్లు', 'utensils'), // existing
      sub('tiffin-centres', 'Tiffin Centres', 'టిఫిన్ సెంటర్లు', 'coffee'), // existing
      sub('sweets-bakery', 'Sweets & Bakery', 'స్వీట్స్ & బేకరీ', 'cake'), // existing (bakeries)
      sub('cafes-juice', 'Cafés & Juice Shops', 'కేఫ్‌లు & జ్యూస్ షాపులు', 'cup-soda'), // existing (cafés)
      sub('street-food', 'Street Food', 'స్ట్రీట్ ఫుడ్', 'utensils'),
    ],
  },
  {
    slug: 'shopping', name: { en: 'Shopping', te: 'షాపింగ్' }, icon: 'shopping-bag',
    children: [
      sub('clothing-textiles', 'Clothing & Textiles', 'బట్టలు & వస్త్రాలు', 'shirt'), // existing
      sub('supermarkets', 'Supermarkets', 'సూపర్ మార్కెట్లు', 'shopping-cart'),
      sub('grocery-kirana', 'Grocery & Kirana', 'కిరాణా & సరుకులు', 'shopping-basket'), // existing
      sub('electronics-mobiles', 'Electronics & Mobiles', 'ఎలక్ట్రానిక్స్ & మొబైల్స్', 'smartphone'), // existing
      sub('footwear', 'Footwear', 'చెప్పులు & బూట్లు', 'footprints'),
      sub('jewellery', 'Jewellery', 'నగలు', 'gem'), // existing
      sub('hardware-building', 'Hardware & Building Materials', 'హార్డ్‌వేర్ & నిర్మాణ సామగ్రి', 'hammer'), // existing
      sub('books-stationery', 'Books & Stationery', 'పుస్తకాలు & స్టేషనరీ', 'book-open'), // existing
    ],
  },
  {
    slug: 'health-medical', name: { en: 'Health & Medical', te: 'ఆరోగ్యం & వైద్యం' }, icon: 'heart-pulse',
    children: [
      sub('hospitals', 'Hospitals', 'ఆసుపత్రులు', 'hospital'),
      sub('clinics', 'Clinics', 'క్లినిక్‌లు', 'stethoscope'),
      sub('pharmacies', 'Pharmacies', 'మందుల షాపులు', 'pill'),
      sub('dental-clinics', 'Dental Clinics', 'దంత వైద్యశాలలు', 'smile'),
      sub('diagnostic-labs', 'Diagnostic Labs', 'డయాగ్నస్టిక్ ల్యాబ్‌లు', 'flask-conical'),
    ],
  },
  {
    slug: 'education', name: { en: 'Education', te: 'విద్య' }, icon: 'graduation-cap',
    children: [
      sub('schools', 'Schools', 'పాఠశాలలు', 'school'),
      sub('colleges', 'Colleges', 'కళాశాలలు', 'graduation-cap'),
      sub('tuition-centres', 'Tuition Centres', 'ట్యూషన్ సెంటర్లు', 'book-open'),
      sub('coaching-centres', 'Coaching Centres', 'కోచింగ్ సెంటర్లు', 'notebook-pen'),
    ],
  },
  {
    slug: 'home-repairs', name: { en: 'Home & Repairs', te: 'ఇల్లు & రిపేర్లు' }, icon: 'wrench',
    children: [
      sub('plumbers', 'Plumbers', 'ప్లంబర్లు', 'wrench'),
      sub('electricians', 'Electricians', 'ఎలక్ట్రీషియన్లు', 'plug'),
      sub('painters', 'Painters', 'పెయింటర్లు', 'paint-roller'),
      sub('ac-repair', 'AC Repair', 'ఏసీ రిపేర్', 'air-vent'),
      sub('carpenters', 'Carpenters', 'వడ్రంగులు', 'hammer'),
      sub('repairs', 'Repairs & Servicing', 'రిపేర్లు & సర్వీసింగ్', 'wrench'), // existing
      sub('electricians-plumbers', 'Electricians & Plumbers', 'ఎలక్ట్రీషియన్లు & ప్లంబర్లు', 'plug'), // existing (superseded)
    ],
  },
  {
    slug: 'beauty-personal-care', name: { en: 'Beauty & Personal Care', te: 'అందం & వ్యక్తిగత సంరక్షణ' }, icon: 'sparkles',
    children: [
      sub('salons', 'Salons', 'సెలూన్లు', 'scissors'),
      sub('beauty-parlours', 'Beauty Parlours', 'బ్యూటీ పార్లర్లు', 'sparkles'),
      sub('spas', 'Spas', 'స్పాలు', 'flower'),
      sub('salons-beauty', 'Salons & Beauty', 'సెలూన్లు & బ్యూటీ', 'sparkles'), // existing (superseded)
    ],
  },
  {
    slug: 'vehicles-transport', name: { en: 'Vehicles & Transport', te: 'వాహనాలు & రవాణా' }, icon: 'car',
    children: [
      sub('mechanics', 'Mechanics', 'మెకానిక్‌లు', 'wrench'),
      sub('bike-repair', 'Bike Repair', 'బైక్ రిపేర్', 'bike'),
      sub('car-repair', 'Car Repair', 'కార్ రిపేర్', 'car'),
      sub('vehicle-rentals', 'Rentals', 'అద్దె వాహనాలు', 'key'),
    ],
  },
  {
    slug: 'hotels-stay', name: { en: 'Hotels & Stay', te: 'హోటళ్లు & బస' }, icon: 'bed',
    children: [
      sub('hotels', 'Hotels', 'హోటళ్లు', 'bed'),
      sub('lodges', 'Lodges', 'లాడ్జీలు', 'bed'),
      sub('guest-houses', 'Guest Houses', 'గెస్ట్ హౌస్‌లు', 'house'),
    ],
  },
  {
    slug: 'professional-services', name: { en: 'Professional Services', te: 'వృత్తిపరమైన సేవలు' }, icon: 'briefcase',
    children: [
      sub('accountants', 'Accountants', 'అకౌంటెంట్లు', 'calculator'),
      sub('lawyers', 'Lawyers', 'న్యాయవాదులు', 'scale'),
      sub('photographers', 'Photographers', 'ఫోటోగ్రాఫర్లు', 'camera'),
      sub('computer-services', 'Computer Services', 'కంప్యూటర్ సేవలు', 'monitor'),
      sub('tailoring', 'Tailoring', 'టైలరింగ్', 'scissors'), // existing
    ],
  },
  {
    slug: 'events-entertainment', name: { en: 'Events & Entertainment', te: 'వేడుకలు & వినోదం' }, icon: 'party-popper',
    children: [
      sub('function-halls', 'Function Halls', 'ఫంక్షన్ హాళ్లు', 'landmark'),
      sub('decorators', 'Decorators', 'డెకరేటర్లు', 'sparkles'),
      sub('event-planners', 'Event Planners', 'ఈవెంట్ ప్లానర్లు', 'calendar'),
      sub('cinema', 'Cinema', 'సినిమా హాళ్లు', 'clapperboard'),
    ],
  },
];

export const BUSINESS_CATEGORY_TREE = tree.map((main, i) => ({
  ...main,
  sortOrder: (i + 1) * 10,
  children: main.children.map((c, j) => ({ ...c, sortOrder: (j + 1) * 10 })),
}));

/**
 * Original flat-seed subcategories replaced by more specific ones. The
 * migration deactivates them ONLY if no business references them.
 */
export const SUPERSEDED_SUBCATEGORIES = ['electricians-plumbers', 'salons-beauty'];

const flat = (type, rows) =>
  rows.map(([slug, en, te, icon], i) => ({ type, slug, name: { en, te }, icon, sortOrder: (i + 1) * 10 }));

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

/** Flat (single-level) categories for events and news. */
export const CATEGORY_SEED = [...flat('event', event), ...flat('news', news)];
