'use client';

import { useState } from 'react';
import { supabase, type Diet, type Dish, type BringItem, type Drink } from '@/lib/supabase';
import { MEALS, MEAL_LABEL, DIET_LABEL, type Meal, type DietTag, MEAL_DEFAULT_HEADS, KID_FACTOR } from '@/lib/data';
import { computeMealQuantities, fmtQty, getMealBreakdown } from '@/lib/logic';
import { Field, GhostBtn, PrimaryBtn, Chip, Pill, Seg, MultiSelect } from './ui';

type FoodSubTab = 'diet' | 'bring' | 'menu' | 'plan';

export function FoodSection({
  subTab, setSubTab, diets, dishes, bring, drinks, hostUnlocked, flash,
}: {
  subTab: FoodSubTab;
  setSubTab: (s: FoodSubTab) => void;
  diets: Diet[]; dishes: Dish[]; bring: BringItem[]; drinks: Drink[];
  hostUnlocked: boolean;
  flash: (m: string) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { v: 'diet', label: 'diet survey' },
          { v: 'bring', label: 'what to bring' },
          { v: 'menu', label: 'menu' + (hostUnlocked ? '' : ' 🔒') },
          { v: 'plan', label: 'plan' + (hostUnlocked ? '' : ' 🔒') },
        ] as { v: FoodSubTab; label: string }[]).map(t => (
          <button key={t.v} onClick={() => setSubTab(t.v)} style={{
            padding: '6px 12px', border: '0.5px solid var(--border)',
            background: subTab === t.v ? 'var(--surface-2)' : 'transparent',
            color: subTab === t.v ? 'var(--text)' : 'var(--text-2)',
            borderRadius: 'var(--radius-md)', fontSize: 13,
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === 'diet' && <DietSurvey diets={diets} flash={flash} />}
      {subTab === 'bring' && <BringList bring={bring} dishes={dishes} flash={flash} />}
      {subTab === 'menu' && (hostUnlocked
        ? <MenuEditor dishes={dishes} drinks={drinks} flash={flash} />
        : <Locked />)}
      {subTab === 'plan' && (hostUnlocked
        ? <Plan diets={diets} dishes={dishes} bring={bring} drinks={drinks} flash={flash} />
        : <Locked />)}
    </div>
  );
}

function Locked() {
  return (
    <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-lg)', textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
      unlock host area at the top of the page
    </div>
  );
}

// ============ DIET SURVEY (guest-facing) ============
function DietSurvey({ diets, flash }: { diets: Diet[]; flash: (m: string) => void }) {
  const [name, setName] = useState('');
  const [diet, setDiet] = useState<DietTag>('omni');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [attending, setAttending] = useState<Set<string>>(new Set(MEALS));

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return flash('enter your name');
    if (attending.size === 0) return flash('pick at least one meal');
    const existing = diets.find(d => d.name.toLowerCase() === nm.toLowerCase());
    const payload = { name: nm, diet, allergies: allergies.trim(), notes: notes.trim(), attending: Array.from(attending) };
    const { error } = existing
      ? await supabase.from('diets').update(payload).eq('id', existing.id)
      : await supabase.from('diets').insert(payload);
    if (error) return flash('save failed');
    setName(''); setAllergies(''); setNotes(''); setDiet('omni'); setAttending(new Set(MEALS));
    flash(existing ? 'updated!' : 'saved!');
  };

  return (
    <>
      <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius-lg)', marginBottom: 14, fontSize: 13, color: 'var(--text-2)' }}>
        one entry per person. if you fill in your name again later, it&apos;ll update.
      </div>
      <Field label="your name (one entry per person)">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria" />
      </Field>
      <Field label="diet">
        <Seg value={diet} onChange={v => setDiet(v as DietTag)} options={[
          { v: 'omni', label: 'omnivore' },
          { v: 'veg', label: 'vegetarian' },
          { v: 'vegan', label: 'vegan' },
          { v: 'pesc', label: 'pescatarian' },
          { v: 'other', label: 'other' },
        ]} />
      </Field>
      <Field label="allergies / intolerances (optional)" hint="e.g. nuts, lactose, gluten">
        <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} />
      </Field>
      <Field label="which meals are you joining?" hint="tap to toggle. defaults to all 5.">
        <MultiSelect values={attending} onChange={setAttending}
          options={MEALS.map(m => ({ v: m, label: MEAL_LABEL[m] }))} />
      </Field>
      <Field label="anything else? (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <PrimaryBtn onClick={submit}>save</PrimaryBtn>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>filled out by ({diets.length})</div>
        {diets.length === 0
          ? <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>no one yet</div>
          : diets.map(d => (
            <div key={d.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{d.name}</span> · <Pill>{DIET_LABEL[d.diet as DietTag]}</Pill>
              {d.allergies && <span style={{ color: 'var(--warn-fg)', marginLeft: 6, fontSize: 12 }}> ⚠ {d.allergies}</span>}
              <div style={{ marginTop: 2 }}>
                {d.attending.map(m => <Chip key={m}>{MEAL_LABEL[m as Meal]}</Chip>)}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

// ============ BRING LIST (guest-facing) ============
function BringList({ bring, dishes, flash }: { bring: BringItem[]; dishes: Dish[]; flash: (m: string) => void }) {
  const [meal, setMeal] = useState<Meal>('fri_dinner');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');

  const submit = async () => {
    if (!name.trim()) return flash('your name?');
    if (!desc.trim()) return flash('what are you bringing?');
    const { error } = await supabase.from('bring_items').insert({
      meal, description: desc.trim(), brought_by: name.trim(), quantity: qty.trim() || null,
    });
    if (error) return flash('save failed');
    setDesc(''); setQty('');
    flash('thanks!');
  };

  const remove = async (id: string) => {
    if (!confirm('remove this?')) return;
    await supabase.from('bring_items').delete().eq('id', id);
  };

  return (
    <>
      <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius-lg)', marginBottom: 14, fontSize: 13, color: 'var(--text-2)' }}>
        sign up for what you&apos;ll bring. helps the host know what NOT to buy.
      </div>
      <Field label="for which meal?">
        <select value={meal} onChange={e => setMeal(e.target.value as Meal)} style={{
          padding: '8px 10px', fontSize: 14, border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)', background: 'var(--surface)', width: '100%',
        }}>
          {MEALS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
        </select>
      </Field>
      <Field label="your name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tom" />
      </Field>
      <Field label="what are you bringing?" hint='e.g. "potato salad", "2 bottles of red wine", "homemade bread"'>
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} />
      </Field>
      <Field label="quantity (optional)" hint='e.g. "2kg", "for ~10 people", "1 tray"'>
        <input type="text" value={qty} onChange={e => setQty(e.target.value)} />
      </Field>
      <PrimaryBtn onClick={submit}>sign up</PrimaryBtn>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>signed up so far</div>
        {MEALS.map(m => {
          const items = bring.filter(b => b.meal === m);
          if (!items.length) return null;
          return (
            <div key={m} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 4 }}>{MEAL_LABEL[m]}</div>
              {items.map(b => (
                <div key={b.id} style={{
                  background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
                  padding: '8px 12px', marginBottom: 4, fontSize: 13,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}>
                  <span>
                    <strong>{b.description}</strong>
                    {b.quantity && <span style={{ color: 'var(--text-2)' }}> ({b.quantity})</span>}
                    <span style={{ color: 'var(--text-3)' }}> · {b.brought_by}</span>
                  </span>
                  <button onClick={() => remove(b.id!)} style={{
                    padding: '2px 6px', background: 'transparent', color: 'var(--danger-fg)',
                    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 10,
                  }}>×</button>
                </div>
              ))}
            </div>
          );
        })}
        {bring.length === 0 && <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>nothing yet</div>}
      </div>
    </>
  );
}

// ============ MENU EDITOR (host-only) ============
function MenuEditor({ dishes, drinks, flash }: { dishes: Dish[]; drinks: Drink[]; flash: (m: string) => void }) {
  const [meal, setMeal] = useState<Meal>('fri_dinner');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Dish['category']>('main');
  const [covers, setCovers] = useState<Set<string>>(new Set(['omni', 'veg', 'vegan', 'pesc']));
  const [portion, setPortion] = useState('150');
  const [unit, setUnit] = useState<Dish['unit']>('g');

  const [drinkName, setDrinkName] = useState('');
  const [drinkQty, setDrinkQty] = useState('');

  const addDish = async () => {
    if (!name.trim()) return flash('dish name?');
    if (covers.size === 0) return flash('which diets does this cover?');
    const p = parseInt(portion);
    if (isNaN(p) || p < 1) return flash('portion size?');
    const { error } = await supabase.from('dishes').insert({
      meal, name: name.trim(), category, covers: Array.from(covers), portion_g: p, unit,
    });
    if (error) return flash('save failed');
    setName(''); setPortion('150');
    flash('added');
  };

  const remove = async (id: string) => {
    if (!confirm('remove this dish?')) return;
    await supabase.from('dishes').delete().eq('id', id);
  };

  const addDrink = async () => {
    if (!drinkName.trim() || !drinkQty.trim()) return flash('name and target qty?');
    const { error } = await supabase.from('drinks').insert({ name: drinkName.trim(), qty_target: drinkQty.trim() });
    if (error) return flash('save failed');
    setDrinkName(''); setDrinkQty('');
    flash('added');
  };
  const rmDrink = async (id: string) => {
    if (!confirm('remove?')) return;
    await supabase.from('drinks').delete().eq('id', id);
  };

  const seedDefaults = async () => {
    if (dishes.length > 0 || drinks.length > 0) {
      if (!confirm('this will ADD the default menu on top of what you have. continue?')) return;
    }
    const defaultDishes: Omit<Dish, 'id'>[] = [
      { meal: 'fri_dinner', name: 'Pasta (mixed shapes)', category: 'main', covers: ['omni','veg','vegan','pesc'], portion_g: 120, unit: 'g', notes: 'dry weight; adults 120g, kids ~80g' },
      { meal: 'fri_dinner', name: 'Tomato / veggie sauce', category: 'side', covers: ['omni','veg','vegan','pesc'], portion_g: 200, unit: 'g' },
      { meal: 'fri_dinner', name: 'Meat sauce (bolognese)', category: 'side', covers: ['omni'], portion_g: 200, unit: 'g', notes: 'optional second sauce for omni' },
      { meal: 'fri_dinner', name: 'Parmesan', category: 'side', covers: ['omni','veg','pesc'], portion_g: 30, unit: 'g' },
      { meal: 'fri_dinner', name: 'Bread', category: 'bread', covers: ['omni','veg','vegan','pesc'], portion_g: 60, unit: 'g' },
      { meal: 'fri_dinner', name: 'Salad (guest-brought)', category: 'salad', covers: ['omni','veg','vegan','pesc'], portion_g: 80, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Bread / rolls', category: 'bread', covers: ['omni','veg','vegan','pesc'], portion_g: 80, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Butter', category: 'side', covers: ['omni','veg','pesc'], portion_g: 15, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Mixed cheese', category: 'side', covers: ['omni','veg','pesc'], portion_g: 40, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Cold cuts', category: 'side', covers: ['omni'], portion_g: 40, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Eggs', category: 'main', covers: ['omni','veg','pesc'], portion_g: 1, unit: 'piece' },
      { meal: 'sat_breakfast', name: 'Jam / honey', category: 'side', covers: ['omni','veg','vegan','pesc'], portion_g: 20, unit: 'g' },
      { meal: 'sat_breakfast', name: 'Fruit', category: 'side', covers: ['omni','veg','vegan','pesc'], portion_g: 100, unit: 'g' },
      { meal: 'sat_lunch', name: 'Light snacks / leftovers', category: 'main', covers: ['omni','veg','vegan','pesc'], portion_g: 150, unit: 'g' },
      { meal: 'sat_lunch', name: 'Bread', category: 'bread', covers: ['omni','veg','vegan','pesc'], portion_g: 60, unit: 'g' },
      { meal: 'sat_dinner', name: 'Spanferkel (suckling pig)', category: 'main', covers: ['omni'], portion_g: 250, unit: 'g', notes: 'cooked weight per eater; raw ~2x' },
      { meal: 'sat_dinner', name: 'BBQ veg / halloumi (guest-brought)', category: 'main', covers: ['veg','vegan','pesc'], portion_g: 200, unit: 'g' },
      { meal: 'sat_dinner', name: 'Burger / sausages (guest-brought)', category: 'side', covers: ['omni'], portion_g: 150, unit: 'g' },
      { meal: 'sat_dinner', name: 'Bread / buns', category: 'bread', covers: ['omni','veg','vegan','pesc'], portion_g: 80, unit: 'g' },
      { meal: 'sat_dinner', name: 'Salads (guest-brought)', category: 'salad', covers: ['omni','veg','vegan','pesc'], portion_g: 150, unit: 'g' },
      { meal: 'sun_brunch', name: 'Leftovers', category: 'main', covers: ['omni','veg','vegan','pesc'], portion_g: 150, unit: 'g' },
      { meal: 'sun_brunch', name: 'Fresh bread', category: 'bread', covers: ['omni','veg','vegan','pesc'], portion_g: 80, unit: 'g' },
      { meal: 'sun_brunch', name: 'Scrambled eggs', category: 'main', covers: ['omni','veg','pesc'], portion_g: 1, unit: 'piece' },
      { meal: 'sun_brunch', name: 'Fruit', category: 'side', covers: ['omni','veg','vegan','pesc'], portion_g: 100, unit: 'g' },
    ];
    const defaultDrinks: Omit<Drink, 'id'>[] = [
      { name: 'Beer', qty_target: '4-5 crates (80-100 bottles)', notes: '2-3 per adult per evening' },
      { name: 'Red wine', qty_target: '8-10 bottles' },
      { name: 'White wine', qty_target: '8-10 bottles' },
      { name: 'Sparkling wine', qty_target: '4-6 bottles', notes: 'birthday toast' },
      { name: 'Still water', qty_target: '25 L' },
      { name: 'Sparkling water', qty_target: '25 L' },
      { name: 'Soft drinks (cola/fanta)', qty_target: '15 L' },
      { name: 'Juice (kids)', qty_target: '6 L' },
      { name: 'Coffee beans (weekend total)', qty_target: '500 g' },
      { name: 'Milk', qty_target: '5 L' },
    ];
    const dResult = await supabase.from('dishes').insert(defaultDishes);
    const drResult = await supabase.from('drinks').insert(defaultDrinks);
    if (dResult.error || drResult.error) return flash('seed failed');
    flash('default menu loaded!');
  };

  const wipeMenu = async () => {
    if (!confirm('wipe all dishes and drinks?')) return;
    await supabase.from('dishes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('drinks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    flash('cleared');
  };

  return (
    <>
      <div style={{ background: 'var(--info-bg)', color: 'var(--info-fg)', padding: '12px 14px', borderRadius: 'var(--radius-lg)', marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
        <strong>how this works:</strong> add dishes per meal. mark which diets each covers (a vegan main only feeds vegans; a salad usually covers all). the plan tab calculates quantities.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <PrimaryBtn onClick={seedDefaults}>load default menu (pasta + BBQ + leftovers)</PrimaryBtn>
        <GhostBtn onClick={wipeMenu} danger>wipe menu</GhostBtn>
      </div>

      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>add a dish</div>
      <Field label="meal">
        <select value={meal} onChange={e => setMeal(e.target.value as Meal)} style={{
          padding: '8px 10px', fontSize: 14, border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)', background: 'var(--surface)', width: '100%',
        }}>
          {MEALS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
        </select>
      </Field>
      <Field label="dish name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Roast pork, Lentil curry, Caesar salad" />
      </Field>
      <Field label="category">
        <Seg value={category} onChange={v => setCategory(v as any)} options={[
          { v: 'main', label: 'main' }, { v: 'side', label: 'side' }, { v: 'salad', label: 'salad' },
          { v: 'bread', label: 'bread' }, { v: 'dessert', label: 'dessert' }, { v: 'other', label: 'other' },
        ]} />
      </Field>
      <Field label="which diets does this cover?" hint="a meat dish covers omnivores only. a veggie dish covers veg + vegan if no dairy. a salad usually covers all.">
        <MultiSelect values={covers} onChange={setCovers} options={[
          { v: 'omni', label: 'omni' }, { v: 'veg', label: 'veg' }, { v: 'vegan', label: 'vegan' },
          { v: 'pesc', label: 'pesc' }, { v: 'other', label: 'other' },
        ]} />
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 2 }}>
          <Field label="portion per person" hint="grams (or pieces if unit = piece)">
            <input type="text" value={portion} onChange={e => setPortion(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="unit">
            <select value={unit} onChange={e => setUnit(e.target.value as any)} style={{
              padding: '8px 10px', fontSize: 14, border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface)', width: '100%',
            }}>
              <option value="g">grams</option>
              <option value="piece">pieces</option>
              <option value="ml">ml</option>
            </select>
          </Field>
        </div>
      </div>
      <PrimaryBtn onClick={addDish}>add dish</PrimaryBtn>

      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 24, marginBottom: 8 }}>menu so far</div>
      {MEALS.map(m => {
        const mealDishes = dishes.filter(d => d.meal === m);
        if (!mealDishes.length) return null;
        return (
          <div key={m} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>{MEAL_LABEL[m]}</div>
            {mealDishes.map(d => (
              <div key={d.id} style={{
                background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
              }}>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <strong>{d.name}</strong>
                  <span style={{ color: 'var(--text-3)' }}> · {d.category} · {d.portion_g}{d.unit === 'g' ? 'g' : d.unit}/pers</span>
                  <div>{d.covers.map(c => <Chip key={c}>{c}</Chip>)}</div>
                </div>
                <button onClick={() => remove(d.id!)} style={{
                  padding: '2px 6px', background: 'transparent', color: 'var(--danger-fg)',
                  border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 10,
                }}>×</button>
              </div>
            ))}
          </div>
        );
      })}
      {dishes.length === 0 && <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>no dishes yet</div>}

      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 24, marginBottom: 8 }}>drinks for the weekend</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="text" value={drinkName} onChange={e => setDrinkName(e.target.value)} placeholder="e.g. Red wine" style={{ flex: 2 }} />
        <input type="text" value={drinkQty} onChange={e => setDrinkQty(e.target.value)} placeholder="qty (e.g. 20 bottles)" style={{ flex: 2 }} />
        <PrimaryBtn onClick={addDrink}>add</PrimaryBtn>
      </div>
      {drinks.map(d => (
        <div key={d.id} style={{
          background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--radius-md)',
          marginBottom: 4, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span><strong>{d.name}</strong> <span style={{ color: 'var(--text-3)' }}>· target: {d.qty_target}</span></span>
          <button onClick={() => rmDrink(d.id!)} style={{
            padding: '2px 6px', background: 'transparent', color: 'var(--danger-fg)',
            border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 10,
          }}>×</button>
        </div>
      ))}
    </>
  );
}

// ============ PLAN (host-only): the quantity calculator ============
function Plan({ diets, dishes, bring, drinks, flash }: {
  diets: Diet[]; dishes: Dish[]; bring: BringItem[]; drinks: Drink[]; flash: (m: string) => void;
}) {
  const copyShopping = () => {
    let txt = `Forsthaus Korleput — shopping & cooking plan\n\n`;
    MEALS.forEach(m => {
      const { dishQty, unfedDiets, totalEaters } = computeMealQuantities(m, dishes, diets);
      if (dishQty.length === 0) return;
      const { source } = getMealBreakdown(m, diets);
      txt += `\n=== ${MEAL_LABEL[m].toUpperCase()} ===\n`;
      txt += `(${totalEaters.toFixed(1)} adult-equivalents${source === 'defaults' ? ' — using default headcounts, no survey data yet' : ''})\n`;
      if (unfedDiets.length > 0) txt += `⚠ no main course for: ${unfedDiets.join(', ')}\n`;
      dishQty.forEach(({ dish, eaters, totalQty }) => {
        const brought = bring.filter(b =>
          b.meal === m && (
            b.description.toLowerCase().includes(dish.name.toLowerCase()) ||
            dish.name.toLowerCase().includes(b.description.toLowerCase())
          )
        );
        let line = `  ${dish.name} (${dish.category}): ${fmtQty(totalQty, dish.unit)} for ${eaters.toFixed(1)} eaters`;
        if (brought.length) {
          line += ` — guests bringing: ${brought.map(b => `${b.brought_by}${b.quantity ? ` (${b.quantity})` : ''}`).join(', ')}`;
        }
        txt += line + '\n';
      });
    });
    if (drinks.length) {
      txt += `\n=== DRINKS (weekend) ===\n`;
      drinks.forEach(d => { txt += `  ${d.name}: ${d.qty_target}\n`; });
    }
    navigator.clipboard.writeText(txt).then(() => flash('copied!'));
  };

  const surveyed = diets.length;
  const allMealsAttended: Record<Meal, number> = {} as any;
  MEALS.forEach(m => allMealsAttended[m] = diets.filter(d => d.attending.includes(m)).length);

  return (
    <>
      <div style={{ background: 'var(--info-bg)', color: 'var(--info-fg)', padding: '12px 14px', borderRadius: 'var(--radius-lg)', marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
        <strong>quantities calculated from menu × diets × headcount.</strong> dishes guests are bringing get flagged on each line.
        {surveyed === 0 && <><br /><br />⚠ no survey data yet — using default headcounts (Fri: 22a + 12k, Sat+Sun: 28a + 17k, all omnivore).</>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <PrimaryBtn onClick={copyShopping}>copy full plan</PrimaryBtn>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
        survey responses: {surveyed} · per meal: {MEALS.map(m => `${MEAL_LABEL[m]}: ${allMealsAttended[m]}`).join(' · ')}
      </div>

      {MEALS.map(m => {
        const { dishQty, unfedDiets, totalEaters } = computeMealQuantities(m, dishes, diets);
        const breakdown = getMealBreakdown(m, diets);
        if (dishQty.length === 0 && breakdown.attending.length === 0) {
          return (
            <div key={m} style={{
              background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius-lg)',
              marginBottom: 10, fontSize: 13, color: 'var(--text-3)',
            }}>
              <strong style={{ color: 'var(--text)' }}>{MEAL_LABEL[m]}</strong> — no dishes set yet
            </div>
          );
        }
        return (
          <div key={m} style={{
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{MEAL_LABEL[m]}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 10 }}>
              {totalEaters.toFixed(1)} adult-equivalents{breakdown.source === 'defaults' ? ' (default, no survey)' : ''}
              {breakdown.source === 'survey' && (
                <> · {Object.entries(breakdown.byDiet).filter(([, n]) => n > 0).map(([d, n]) => `${n.toFixed(1)} ${d}`).join(' · ')}</>
              )}
            </div>
            {unfedDiets.length > 0 && (
              <div style={{ background: 'var(--warn-bg)', color: 'var(--warn-fg)', padding: '6px 10px', borderRadius: 'var(--radius-md)', fontSize: 12, marginBottom: 8 }}>
                ⚠ no main course covers: {unfedDiets.join(', ')}
              </div>
            )}
            {dishQty.map(({ dish, eaters, totalQty }) => {
              const brought = bring.filter(b =>
                b.meal === m && (
                  b.description.toLowerCase().includes(dish.name.toLowerCase()) ||
                  dish.name.toLowerCase().includes(b.description.toLowerCase())
                )
              );
              return (
                <div key={dish.id} style={{ borderBottom: '0.5px solid var(--border)', padding: '6px 0', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span><strong>{dish.name}</strong> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>· {dish.category}</span></span>
                    <span style={{ fontWeight: 500, color: eaters === 0 ? 'var(--text-3)' : 'var(--text)' }}>
                      {eaters === 0 ? '— nobody eats this' : `${fmtQty(totalQty, dish.unit)} (${eaters.toFixed(1)} eaters)`}
                    </span>
                  </div>
                  {brought.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--success-fg)', marginTop: 2 }}>
                      ✓ {brought.map(b => `${b.brought_by}${b.quantity ? ` (${b.quantity})` : ''}`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {drinks.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Drinks · whole weekend</div>
          {drinks.map(d => (
            <div key={d.id} style={{ padding: '4px 0', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{d.name}</strong></span>
              <span style={{ fontWeight: 500 }}>{d.qty_target}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
