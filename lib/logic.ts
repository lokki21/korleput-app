import { ROOMS, KID_FACTOR, DIET_CAN_EAT, MEAL_DEFAULT_HEADS } from './data';
import type { Request, Diet, Dish, BringItem } from './supabase';
import type { Meal, DietTag } from './data';

// ============ ROOM OPTIMIZER ============
export function optimizeNight(requests: Request[]) {
  const assignments: Record<string, string[]> = {};
  ROOMS.forEach(r => assignments[r.id] = []);
  const notes: string[] = [];
  const groups = requests.map(r => ({ ...r, size: r.members.length, placed: false }));
  groups.sort((a, b) => {
    const score = (g: any) => {
      let s = 0;
      if (g.type === 'family') s -= 60 + g.size * 2;
      if (g.type === 'couple') s -= 30;
      if (g.priv === 'private') s -= 20;
      s -= g.size * 3;
      return s;
    };
    return score(a) - score(b);
  });
  const roomFree = (id: string) => ROOMS.find(x => x.id === id)!.beds - assignments[id].length;
  const place = (g: any, rid: string) => { assignments[rid].push(...g.members); g.placed = true; };

  groups.forEach(g => {
    if (g.placed) return;
    const wantsOwn = g.priv === 'private' || g.type === 'family' || g.type === 'couple';
    let cands = ROOMS.filter(r => roomFree(r.id) >= g.size);
    if (wantsOwn) {
      const privCands = cands.filter(r => assignments[r.id].length === 0);
      if (privCands.length) {
        privCands.sort((a, b) => (a.beds - g.size) - (b.beds - g.size));
        place(g, privCands[0].id);
        return;
      }
      if (g.type === 'family' || g.type === 'couple') notes.push(`${g.lead}'s group: no private room — sharing.`);
    }
    if (cands.length) {
      cands.sort((a, b) => (a.beds - g.size) - (b.beds - g.size));
      place(g, cands[0].id);
      return;
    }
    let remaining = g.members.slice();
    ROOMS.forEach(r => {
      const free = roomFree(r.id);
      if (free > 0 && remaining.length) {
        const take = remaining.splice(0, free);
        assignments[r.id].push(...take);
      }
    });
    if (remaining.length) notes.push(`⚠ no bed for ${remaining.join(', ')} (${g.lead})`);
    else notes.push(`${g.lead}'s group split across rooms.`);
    g.placed = true;
  });
  return { assignments, notes };
}

// ============ FOOD MATH ============

/**
 * For a given meal, returns the breakdown of attendees by diet,
 * weighted by adult-equivalent (kids count as KID_FACTOR).
 * If guests have submitted diet info, we use those individuals.
 * Otherwise we fall back to MEAL_DEFAULT_HEADS assuming all omnivore.
 */
export function getMealBreakdown(meal: Meal, diets: Diet[]): {
  byDiet: Record<DietTag, number>;
  total: number;
  attending: Diet[];
  source: 'survey' | 'defaults';
} {
  const attending = diets.filter(d => d.attending.includes(meal));
  if (attending.length === 0) {
    // No survey data: use defaults, assume all omnivore
    const def = MEAL_DEFAULT_HEADS[meal];
    const total = def.adults + def.kids * KID_FACTOR;
    return {
      byDiet: { omni: total, veg: 0, vegan: 0, pesc: 0, other: 0 },
      total,
      attending: [],
      source: 'defaults',
    };
  }
  const byDiet: Record<DietTag, number> = { omni: 0, veg: 0, vegan: 0, pesc: 0, other: 0 };
  attending.forEach(d => {
    // Kids are detected by parentheses in name like "Lucia (8)"
    const isKid = /\(\d+\)/.test(d.name);
    byDiet[d.diet] += isKid ? KID_FACTOR : 1;
  });
  const total = Object.values(byDiet).reduce((s, n) => s + n, 0);
  return { byDiet, total, attending, source: 'survey' };
}

/**
 * For a single meal, compute required quantities per dish.
 * Logic for mains: each eater is assigned the most-restrictive main they can eat.
 * Logic for non-mains (side/salad/bread/dessert): every eater gets a portion.
 * For drinks at a meal level: same as non-mains.
 */
export function computeMealQuantities(
  meal: Meal,
  dishes: Dish[],
  diets: Diet[],
): {
  dishQty: { dish: Dish; eaters: number; totalQty: number }[];
  unfedDiets: DietTag[];
  totalEaters: number;
} {
  const mealDishes = dishes.filter(d => d.meal === meal);
  const { byDiet, total, attending } = getMealBreakdown(meal, diets);

  const mains = mealDishes.filter(d => d.category === 'main');
  const otherDishes = mealDishes.filter(d => d.category !== 'main');

  // Assign each diet group to the most-restrictive main that covers them
  const mainEaters: Record<string, number> = {};
  mains.forEach(m => mainEaters[m.id!] = 0);

  const unfed: DietTag[] = [];

  // Process diets from most restrictive to least
  const order: DietTag[] = ['vegan', 'veg', 'pesc', 'omni', 'other'];
  order.forEach(dietTag => {
    const count = byDiet[dietTag];
    if (count === 0) return;
    // Mains that cover this diet
    const candidates = mains.filter(m => m.covers.includes(dietTag));
    if (candidates.length === 0) {
      // No main suitable — they go unfed for the main course
      if (mains.length > 0) unfed.push(dietTag);
      return;
    }
    // Pick the most-restrictive main available (covers fewest diets = most specific)
    candidates.sort((a, b) => a.covers.length - b.covers.length);
    mainEaters[candidates[0].id!] += count;
  });

  const dishQty: { dish: Dish; eaters: number; totalQty: number }[] = [];
  mains.forEach(m => {
    const eaters = mainEaters[m.id!];
    dishQty.push({ dish: m, eaters, totalQty: eaters * m.portion_g });
  });
  // Non-main dishes: served to whoever it covers
  otherDishes.forEach(d => {
    let eaters = 0;
    order.forEach(dietTag => {
      const count = byDiet[dietTag];
      if (count > 0 && d.covers.includes(dietTag)) eaters += count;
    });
    dishQty.push({ dish: d, eaters, totalQty: eaters * d.portion_g });
  });

  return { dishQty, unfedDiets: [...new Set(unfed)], totalEaters: total };
}

/** Format a gram quantity nicely */
export function fmtQty(grams: number, unit: 'g' | 'piece' | 'ml' | 'L'): string {
  if (unit === 'piece') return `${Math.ceil(grams)} pcs`;
  if (unit === 'ml') {
    if (grams >= 1000) return `${(grams / 1000).toFixed(1)} L`;
    return `${Math.round(grams)} ml`;
  }
  if (unit === 'L') return `${(grams / 1000).toFixed(1)} L`;
  // grams
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}

/** Subtract bring-items from a meal's shopping needs. Best-effort matching by name. */
export function netShopping(
  meal: Meal,
  dishQty: { dish: Dish; totalQty: number }[],
  bring: BringItem[],
): { dish: Dish; totalQty: number; brought: BringItem[] }[] {
  const mealBring = bring.filter(b => b.meal === meal);
  return dishQty.map(({ dish, totalQty }) => {
    const brought = mealBring.filter(b =>
      b.description.toLowerCase().includes(dish.name.toLowerCase()) ||
      dish.name.toLowerCase().includes(b.description.toLowerCase())
    );
    return { dish, totalQty, brought };
  });
}
