'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Request, type Assignment, type Diet, type Dish, type BringItem, type Drink } from '@/lib/supabase';
import { HOST_PIN, type Night, NIGHTS } from '@/lib/data';
import { RoomsSection, emptyAssign } from './rooms';
import { FoodSection } from './food';
import { SectionTabs, PrimaryBtn } from './ui';

type AssignMap = Record<Night, Record<string, string[]>>;

export default function Page() {
  const [section, setSection] = useState<'rooms' | 'food'>('rooms');
  const [roomsTab, setRoomsTab] = useState<'map' | 'book' | 'host'>('map');
  const [foodTab, setFoodTab] = useState<'diet' | 'bring' | 'menu' | 'plan'>('diet');

  // Host PIN
  const [hostUnlocked, setHostUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Data
  const [requests, setRequests] = useState<Request[]>([]);
  const [assignments, setAssignments] = useState<AssignMap>(emptyAssign());
  const [diets, setDiets] = useState<Diet[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [bring, setBring] = useState<BringItem[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);

  // UI
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  const loadAll = useCallback(async () => {
    const [reqs, asns, dts, dshs, br, drk] = await Promise.all([
      supabase.from('requests').select('*').order('created_at'),
      supabase.from('assignments').select('*'),
      supabase.from('diets').select('*').order('created_at'),
      supabase.from('dishes').select('*').order('created_at'),
      supabase.from('bring_items').select('*').order('created_at'),
      supabase.from('drinks').select('*').order('created_at'),
    ]);
    if (reqs.data) setRequests(reqs.data as Request[]);
    if (asns.data) {
      const map: AssignMap = emptyAssign();
      (asns.data as Assignment[]).forEach(a => {
        if (!NIGHTS.includes(a.night as Night)) return;
        const n = a.night as Night;
        if (!map[n][a.room_id]) map[n][a.room_id] = [];
        map[n][a.room_id].push(a.person_name);
      });
      setAssignments(map);
    }
    if (dts.data) setDiets(dts.data as Diet[]);
    if (dshs.data) setDishes(dshs.data as Dish[]);
    if (br.data) setBring(br.data as BringItem[]);
    if (drk.data) setDrinks(drk.data as Drink[]);
  }, []);

  useEffect(() => {
    loadAll();
    const ch = supabase.channel('any')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diets' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bring_items' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drinks' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px 60px', position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, right: 14, background: '#1a1a1a', color: '#fff',
          padding: '8px 14px', borderRadius: 8, fontSize: 13, zIndex: 100,
        }}>{toast}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Forsthaus Korleput</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>party logistics · rooms + food</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!hostUnlocked ? (
            <button onClick={() => setShowPin(!showPin)} style={{
              fontSize: 11, padding: '4px 10px', background: 'transparent',
              border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-3)',
            }}>🔒 host</button>
          ) : (
            <button onClick={() => { setHostUnlocked(false); setShowPin(false); }} style={{
              fontSize: 11, padding: '4px 10px', background: 'var(--success-bg)',
              border: '0.5px solid var(--success-fg)', borderRadius: 'var(--radius-md)', color: 'var(--success-fg)',
            }}>✓ host mode</button>
          )}
        </div>
      </div>

      {showPin && !hostUnlocked && (
        <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)}
            placeholder="PIN" style={{ maxWidth: 100, height: 32 }} autoFocus />
          <PrimaryBtn onClick={() => {
            if (pinInput === HOST_PIN) { setHostUnlocked(true); setShowPin(false); setPinInput(''); }
            else flash('wrong PIN');
          }}>unlock</PrimaryBtn>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <SectionTabs value={section} onChange={setSection as any} options={[
          { v: 'rooms', label: '🛏 rooms' },
          { v: 'food', label: '🍽 food' },
        ]} />
      </div>

      {section === 'rooms' && (
        <RoomsSection
          subTab={roomsTab} setSubTab={setRoomsTab}
          requests={requests} assignments={assignments}
          hostUnlocked={hostUnlocked} flash={flash}
        />
      )}
      {section === 'food' && (
        <FoodSection
          subTab={foodTab} setSubTab={setFoodTab}
          diets={diets} dishes={dishes} bring={bring} drinks={drinks}
          hostUnlocked={hostUnlocked} flash={flash}
        />
      )}
    </div>
  );
}
