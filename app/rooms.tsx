'use client';

import { useState } from 'react';
import { supabase, type Request, type Assignment } from '@/lib/supabase';
import { ROOMS, STATIC_OG, STATIC_EG, NIGHTS, NIGHT_LABEL, TOTAL_BEDS, HOST_PIN, type Night, type Room } from '@/lib/data';
import { optimizeNight } from '@/lib/logic';
import { Field, GhostBtn, PrimaryBtn, Chip, Pill, NightsPill, Seg, MultiSelect } from './ui';

type AssignMap = Record<Night, Record<string, string[]>>;
export const emptyAssign = (): AssignMap => ({ fri: {}, sat: {}, sun: {} });

export function RoomsSection({
  subTab, setSubTab, requests, assignments, hostUnlocked, flash,
}: {
  subTab: 'map' | 'book' | 'host';
  setSubTab: (s: 'map' | 'book' | 'host') => void;
  requests: Request[];
  assignments: AssignMap;
  hostUnlocked: boolean;
  flash: (m: string) => void;
}) {
  const [mapNight, setMapNight] = useState<Night>('fri');
  const [hostNight, setHostNight] = useState<Night>('fri');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [optimizerNotes, setOptimizerNotes] = useState<string[]>([]);

  // Booking form
  const [type, setType] = useState<'solo' | 'couple' | 'family'>('solo');
  const [priv, setPriv] = useState<'private' | 'share'>('private');
  const [leadName, setLeadName] = useState('');
  const [members, setMembers] = useState('');
  const [selectedNights, setSelectedNights] = useState<Set<string>>(new Set(['fri', 'sat']));

  const totalSubs = requests.reduce((s, r) => s + r.members.length, 0);
  const headsForNight = (n: Night) =>
    requests.filter(r => r.nights.includes(n)).reduce((s, r) => s + r.members.length, 0);
  const bedsUsedForNight = (n: Night) =>
    Object.values(assignments[n] || {}).flat().length;

  const submit = async () => {
    const lead = leadName.trim();
    if (!lead) return flash('enter your name');
    if (selectedNights.size === 0) return flash('pick at least one night');
    let mems: string[];
    if (type === 'solo') mems = [lead];
    else {
      mems = members.split('\n').map(s => s.trim()).filter(Boolean);
      if (!mems.length) return flash('list group members');
      if (!mems.includes(lead)) mems.unshift(lead);
    }
    const nights = NIGHTS.filter(n => selectedNights.has(n));
    const { error } = await supabase.from('requests').insert({
      lead, type, members: mems, priv, nights,
    });
    if (error) return flash('save failed');
    setLeadName(''); setMembers('');
    flash('submitted!');
  };

  const removeRequest = async (req: Request) => {
    await supabase.from('requests').delete().eq('id', req.id);
    await supabase.from('assignments').delete().in('person_name', req.members);
  };

  const setPersonRoom = async (night: Night, person: string, newRoom: string) => {
    await supabase.from('assignments').delete().eq('night', night).eq('person_name', person);
    if (newRoom) await supabase.from('assignments').insert({ night, room_id: newRoom, person_name: person });
  };

  const clearAssignments = async () => {
    if (!confirm('clear all assignments?')) return;
    await supabase.from('assignments').delete().neq('night', '___never___');
  };
  const resetAll = async () => {
    if (!confirm('wipe ALL requests AND assignments?')) return;
    await supabase.from('assignments').delete().neq('night', '___never___');
    await supabase.from('requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  };

  const copyPlan = () => {
    let txt = `Forsthaus Korleput — sleeping plan\n\n`;
    NIGHTS.forEach(n => {
      txt += `=== ${NIGHT_LABEL[n].toUpperCase()} ===\n`;
      ROOMS.forEach(r => {
        const occ = (assignments[n] || {})[r.id] || [];
        txt += `Room ${r.name} (${r.beds}): ${occ.length ? occ.join(', ') : '—'}\n`;
      });
      const assigned = new Set(Object.values(assignments[n] || {}).flat());
      const expected: string[] = [];
      requests.forEach(r => { if (r.nights.includes(n)) r.members.forEach(m => { if (!assigned.has(m)) expected.push(m); }); });
      if (expected.length) txt += `UNASSIGNED: ${expected.join(', ')}\n`;
      txt += '\n';
    });
    navigator.clipboard.writeText(txt).then(() => flash('copied!'));
  };

  const runOptimizer = async () => {
    const newAssign: AssignMap = emptyAssign();
    const allNotes: string[] = [];
    NIGHTS.forEach(n => {
      const nightReqs = requests.filter(r => r.nights.includes(n));
      if (!nightReqs.length) return;
      const result = optimizeNight(nightReqs);
      newAssign[n] = result.assignments;
      result.notes.forEach(note => allNotes.push(`${NIGHT_LABEL[n]}: ${note}`));
    });
    await supabase.from('assignments').delete().neq('night', '___never___');
    const rows: Assignment[] = [];
    NIGHTS.forEach(n => Object.entries(newAssign[n]).forEach(([rid, people]) =>
      people.forEach(p => rows.push({ night: n, room_id: rid, person_name: p }))
    ));
    if (rows.length) await supabase.from('assignments').insert(rows);
    setOptimizerNotes(allNotes);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
        {requests.length} groups · {totalSubs} people · {NIGHT_LABEL[mapNight]}: {headsForNight(mapNight)} guests, {bedsUsedForNight(mapNight)}/{TOTAL_BEDS} beds
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['map', 'book', 'host'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding: '6px 12px', border: '0.5px solid var(--border)',
            background: subTab === t ? 'var(--surface-2)' : 'transparent',
            color: subTab === t ? 'var(--text)' : 'var(--text-2)',
            borderRadius: 'var(--radius-md)', fontSize: 13,
          }}>{t}</button>
        ))}
      </div>

      {subTab === 'map' && (
        <>
          <NightTabs value={mapNight} onChange={setMapNight} showFull />
          <FloorPlan floor="OG" rooms={ROOMS.filter(r => r.floor === 'OG')} statics={STATIC_OG}
            assignments={assignments[mapNight]} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
          <FloorPlan floor="EG" rooms={ROOMS.filter(r => r.floor === 'EG')} statics={STATIC_EG}
            assignments={assignments[mapNight]} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
          <Legend />
          <RoomDetail room={selectedRoom ? ROOMS.find(r => r.id === selectedRoom)! : null} assignments={assignments} />
        </>
      )}

      {subTab === 'book' && (
        <>
          <Field label="who's submitting?">
            <Seg value={type} onChange={v => setType(v as any)} options={[
              { v: 'solo', label: 'solo' }, { v: 'couple', label: 'couple' }, { v: 'family', label: 'family / group' },
            ]} />
          </Field>
          <Field label="your name">
            <input type="text" value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="e.g. Maria" />
          </Field>
          {type !== 'solo' && (
            <Field label="everyone in your group (one per line, include yourself)" hint="tip: kid ages in brackets, e.g. Lucia (8)">
              <textarea rows={3} value={members} onChange={e => setMembers(e.target.value)} placeholder={'Maria\nTom\nLucia (8)'} />
            </Field>
          )}
          <Field label="which nights are you staying?" hint="tap to toggle">
            <MultiSelect values={selectedNights} onChange={s => setSelectedNights(s)}
              options={NIGHTS.map(n => ({
                v: n,
                label: n === 'fri' ? 'Fri' : n === 'sat' ? 'Sat' : 'Sun',
                sub: `→ ${n === 'fri' ? 'Sat' : n === 'sat' ? 'Sun' : 'Mon'}`,
              }))} />
          </Field>
          <Field label="private room or happy to share?">
            <Seg value={priv} onChange={v => setPriv(v as any)} options={[
              { v: 'private', label: 'private' }, { v: 'share', label: 'happy to share' },
            ]} />
          </Field>
          <PrimaryBtn onClick={submit}>submit</PrimaryBtn>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>submitted so far</div>
            {requests.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>no one yet — be the first</div>
            ) : requests.map(r => (
              <div key={r.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {r.lead} · {r.type}
                  {r.nights.map(n => <NightsPill key={n}>{n}</NightsPill>)}
                  <Pill style={{ marginLeft: 6 }}>{r.priv === 'private' ? 'private' : 'ok to share'}</Pill>
                </div>
                <div style={{ marginTop: 2 }}>{r.members.map((m, i) => <Chip key={i}>{m}</Chip>)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {subTab === 'host' && (
        hostUnlocked ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={runOptimizer}>run optimizer (all nights)</PrimaryBtn>
              <GhostBtn onClick={clearAssignments}>clear assignments</GhostBtn>
              <GhostBtn onClick={resetAll} danger>reset all rooms</GhostBtn>
              <GhostBtn onClick={copyPlan}>copy plan</GhostBtn>
            </div>
            {optimizerNotes.length > 0 && (
              <div style={{ background: 'var(--info-bg)', color: 'var(--info-fg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 14 }}>
                {optimizerNotes.map((n, i) => <div key={i}>· {n}</div>)}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>requests ({requests.length})</div>
            <div style={{ marginBottom: 18 }}>
              {requests.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>none yet</div>
                : requests.map(r => (
                  <div key={r.id} style={{
                    background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
                    padding: '10px 12px', marginBottom: 8, display: 'flex',
                    justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {r.lead} · {r.type} · {r.members.length}p · {r.priv === 'private' ? 'private' : 'shares ok'}
                        {r.nights.map(n => <NightsPill key={n}>{n}</NightsPill>)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{r.members.join(', ')}</div>
                    </div>
                    <button onClick={() => removeRequest(r)} style={{
                      padding: '4px 8px', background: 'transparent', color: 'var(--danger-fg)',
                      border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 11,
                    }}>×</button>
                  </div>
                ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>manual override</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>per night · auto-saves</div>
            <NightTabs value={hostNight} onChange={setHostNight} />
            <ManualList night={hostNight} requests={requests} assignments={assignments} onChange={setPersonRoom} />
          </>
        ) : (
          <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius-lg)', textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
            unlock host area at the top of the page
          </div>
        )
      )}
    </div>
  );
}

function NightTabs({ value, onChange, showFull }: { value: Night; onChange: (n: Night) => void; showFull?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
      {NIGHTS.map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          padding: '6px 12px', border: '0.5px solid var(--border)',
          background: value === n ? 'var(--surface-2)' : 'transparent',
          color: value === n ? 'var(--text)' : 'var(--text-2)',
          borderRadius: 'var(--radius-md)', fontSize: 12,
        }}>{showFull ? NIGHT_LABEL[n] : (n[0].toUpperCase() + n.slice(1))}</button>
      ))}
    </div>
  );
}

function FloorPlan({ floor, rooms, statics, assignments, selectedRoom, onSelectRoom }: {
  floor: 'OG' | 'EG'; rooms: Room[]; statics: any[];
  assignments: Record<string, string[]>; selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
}) {
  const viewBox = floor === 'OG' ? '0 0 660 200' : '0 0 660 130';
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: '0 0 6px', textTransform: 'lowercase', letterSpacing: '0.04em' }}>
        {floor === 'OG' ? 'obergeschoss · upstairs' : 'erdgeschoss · ground floor'}
      </div>
      <svg viewBox={viewBox} style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 14 }} xmlns="http://www.w3.org/2000/svg">
        {statics.map((s, i) => (
          <g key={i}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={4}
              style={{ fill: 'none', stroke: 'var(--text-3)', strokeWidth: 0.5, strokeDasharray: '3,2' }} />
            <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 3}
              style={{ fontSize: 9, textAnchor: 'middle', pointerEvents: 'none', fill: 'var(--text-3)', fontStyle: 'italic' }}>
              {s.label}
            </text>
          </g>
        ))}
        {rooms.map(r => {
          const occ = (assignments[r.id] || []).length;
          let fill = '#EAF3DE'; let stroke = '#3B6D11';
          if (occ >= r.beds) { fill = '#FCEBEB'; stroke = '#A32D2D'; }
          else if (occ > 0) { fill = '#FAEEDA'; stroke = '#854F0B'; }
          const sw = selectedRoom === r.id ? 3 : 1;
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelectRoom(r.id)}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={4}
                style={{ fill, stroke, strokeWidth: sw, transition: 'all 0.15s' }} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 2}
                style={{ fontSize: 13, fontWeight: 500, textAnchor: 'middle', pointerEvents: 'none' }}>{r.name}</text>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 12}
                style={{ fontSize: 10, textAnchor: 'middle', pointerEvents: 'none', fill: 'var(--text-2)' }}>
                {occ}/{r.beds}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

function Legend() {
  const item = (color: string, border: string, label: string) => (
    <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, border: `1px solid ${border}`, marginRight: 4, verticalAlign: 'middle' }} />{label}</span>
  );
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text-2)', marginTop: 6, flexWrap: 'wrap' }}>
      {item('#EAF3DE', '#3B6D11', 'empty')} {item('#FAEEDA', '#854F0B', 'partial')} {item('#FCEBEB', '#A32D2D', 'full')}
    </div>
  );
}

function RoomDetail({ room, assignments }: { room: Room | null; assignments: AssignMap }) {
  if (!room) return (
    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: 10, marginTop: 16 }}>
      tap a room to see who&apos;s in it
    </div>
  );
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginTop: 16 }}>
      <div style={{ fontWeight: 500 }}>
        Room {room.name} <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>· {room.floor === 'OG' ? 'upstairs' : 'ground floor'} · {room.beds} beds</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{room.note}</div>
      {NIGHTS.map(n => {
        const occ = (assignments[n] || {})[room.id] || [];
        return (
          <div key={n} style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{NIGHT_LABEL[n]}</span>{' '}
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({occ.length}/{room.beds})</span>
            <div style={{ marginTop: 3 }}>
              {occ.length === 0
                ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>empty</span>
                : occ.map((name, i) => <Chip key={i}>{name}</Chip>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManualList({ night, requests, assignments, onChange }: {
  night: Night; requests: Request[]; assignments: AssignMap;
  onChange: (n: Night, p: string, r: string) => void;
}) {
  const people: { name: string; lead: string }[] = [];
  requests.forEach(r => { if (r.nights.includes(night)) r.members.forEach(m => people.push({ name: m, lead: r.lead })); });
  if (!people.length) return <div style={{ fontSize: 13, color: 'var(--text-3)' }}>no one is staying this night</div>;
  const personRoom: Record<string, string> = {};
  Object.entries(assignments[night] || {}).forEach(([rid, names]) => names.forEach(n => personRoom[n] = rid));
  return (
    <div>
      {people.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 500 }}>{p.name}</span> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>· {p.lead}</span>
          </div>
          <select value={personRoom[p.name] || ''} onChange={e => onChange(night, p.name, e.target.value)}
            style={{ padding: '4px 8px', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
            <option value="">—</option>
            {ROOMS.map(r => {
              const occ = ((assignments[night] || {})[r.id] || []).length;
              const isCurrent = personRoom[p.name] === r.id;
              return <option key={r.id} value={r.id} disabled={occ >= r.beds && !isCurrent}>Room {r.name} ({occ}/{r.beds})</option>;
            })}
          </select>
        </div>
      ))}
    </div>
  );
}
