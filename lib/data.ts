export const NIGHTS = ['fri', 'sat', 'sun'] as const;
export type Night = typeof NIGHTS[number];
export const NIGHT_LABEL: Record<Night, string> = {
  fri: 'Fri → Sat',
  sat: 'Sat → Sun',
  sun: 'Sun → Mon',
};

export const MEALS = [
  'fri_dinner', 'sat_breakfast', 'sat_lunch', 'sat_dinner', 'sun_brunch',
] as const;
export type Meal = typeof MEALS[number];
export const MEAL_LABEL: Record<Meal, string> = {
  fri_dinner: 'Fri dinner',
  sat_breakfast: 'Sat breakfast',
  sat_lunch: 'Sat lunch',
  sat_dinner: 'Sat dinner',
  sun_brunch: 'Sun brunch',
};

// Expected headcount per meal (you can adjust)
export const MEAL_DEFAULT_HEADS: Record<Meal, { adults: number; kids: number }> = {
  fri_dinner: { adults: 22, kids: 12 },
  sat_breakfast: { adults: 28, kids: 17 },
  sat_lunch: { adults: 28, kids: 17 },
  sat_dinner: { adults: 28, kids: 17 },
  sun_brunch: { adults: 28, kids: 17 },
};

export const KID_FACTOR = 0.6;

export type DietTag = 'omni' | 'veg' | 'vegan' | 'pesc' | 'other';
export const DIET_LABEL: Record<DietTag, string> = {
  omni: 'omnivore',
  veg: 'vegetarian',
  vegan: 'vegan',
  pesc: 'pescatarian',
  other: 'other',
};

// Diet "what can each one eat" — more restrictive eaters can only eat dishes
// covering their tag. Less restrictive eaters can eat anything.
export const DIET_CAN_EAT: Record<DietTag, DietTag[]> = {
  vegan: ['vegan'],
  veg: ['vegan', 'veg'],
  pesc: ['vegan', 'veg', 'pesc'],
  omni: ['vegan', 'veg', 'pesc', 'omni'],
  other: ['vegan', 'veg', 'pesc', 'omni', 'other'],
};

export type Room = {
  id: string; name: string; floor: 'OG' | 'EG'; beds: number;
  x: number; y: number; w: number; h: number; note: string;
};

export const ROOMS: Room[] = [
  { id: '1', name: '1', floor: 'OG', beds: 4, x: 20,  y: 20, w: 90,  h: 85,  note: 'apt, own seating' },
  { id: '2', name: '2', floor: 'OG', beds: 6, x: 115, y: 20, w: 155, h: 85,  note: 'biggest, family suite' },
  { id: '3', name: '3', floor: 'OG', beds: 2, x: 275, y: 20, w: 70,  h: 85,  note: '2 day-beds, cozy' },
  { id: '4', name: '4', floor: 'OG', beds: 4, x: 350, y: 20, w: 110, h: 85,  note: 'apt, own seating' },
  { id: '5', name: '5', floor: 'OG', beds: 4, x: 465, y: 20, w: 130, h: 115, note: 'apt, own seating' },
  { id: '8', name: '8', floor: 'EG', beds: 2, x: 20,  y: 20, w: 90,  h: 70,  note: 'double, ground floor' },
  { id: '9', name: '9', floor: 'EG', beds: 2, x: 115, y: 20, w: 90,  h: 70,  note: 'double, ground floor' },
];

export const STATIC_OG = [
  { label: 'storage', x: 600, y: 20, w: 40, h: 115 },
  { label: 'storage', x: 20, y: 110, w: 90, h: 60 },
  { label: 'hallway / stairs', x: 115, y: 110, w: 345, h: 60 },
  { label: 'storage', x: 465, y: 140, w: 130, h: 30 },
];
export const STATIC_EG = [
  { label: 'common room', x: 210, y: 20, w: 130, h: 70 },
  { label: 'kitchen', x: 345, y: 20, w: 90, h: 70 },
  { label: 'office', x: 20, y: 95, w: 90, h: 30 },
  { label: 'fireplace room', x: 210, y: 95, w: 130, h: 30 },
  { label: 'bathrooms', x: 440, y: 20, w: 90, h: 105 },
];

export const TOTAL_BEDS = ROOMS.reduce((s, r) => s + r.beds, 0);
export const HOST_PIN = '1234';
