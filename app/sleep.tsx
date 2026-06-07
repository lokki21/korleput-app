'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { supabase, type Request, type Assignment, type OutdoorSpot } from '@/lib/supabase';
import { ROOMS, STATIC_OG, STATIC_EG, NIGHTS, NIGHT_LABEL, TOTAL_BEDS, type Night, type Room } from '@/lib/data';
import { optimizeNight } from '@/lib/logic';
import { Field, GhostBtn, PrimaryBtn, Chip, Pill, NightsPill, Seg, MultiSelect } from './ui';

type SleepType = 'house' | 'tent' | 'car';
type Placement = {
  night: Night;
  spotId: string;          // room id like '1' or outdoor id like 'tent_diego'
  person: string;
  sleepType: SleepType;
};

type AssignMap = Record<Night, Record<string, string[]>>;
export const emptyAssign = (): AssignMap => ({ fri: {}, sat: {}, sun: {} });

const ME_KEY = 'korleput:me';

export function SleepSection({
  subTab, setSubTab, requests, assignments, outdoorSpots, planLocked,
  hostUnlocked, flash,
}: {
  subTab: 'map' | 'host';
  setSubTab: (s: 'map' | 'host') => void;
  requests: Request[];
  assignments: AssignMap;
  outdoorSpots: OutdoorSpot[];
  planLocked: boolean;
  hostUnlocked: boolean;
  flash: (m: string) => void;
}) {
  const [mapNight, setMapNight] = useState<Night>('fri');
  const [hostNight, setHostNight] = useState<Night>('fri');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [optimizerNotes, setOptimizerNotes] = useState<string[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [showMePicker, setShowMePicker] = useState(false);
  const [tapSelected, setTapSelected] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);

  // New tent/car form
  const [newSpotType, setNewSpotType] = useState<'tent' | 'car'>('tent');
  const [newSpotLabel, setNewSpotLabel] = useState('');

  // Load "me" from localStorage
  useEffect(() => {
    try { const m = localStorage.getItem(ME_KEY); if (m) setMe(m); } catch {}
  }, []);

  const setMeAndStore = (name: string | null) => {
    setMe(name);
    try { if (name) localStorage.setItem(ME_KEY, name); else localStorage.removeItem(ME_KEY); } catch {}
  };

  // Compute all known people from requests
  const allPeople = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => r.members.forEach(m => set.add(m)));
    return Array.from(set).sort();
  }, [requests]);

  // Can this user move this person?
  const canMove = (person: string): boolean => {
    if (planLocked && !hostUnlocked) return false;
    if (hostUnlocked) return true;
    return person === me;
  };

  // ============ DATA OPS ============

  const setPersonSpot = async (night: Night, person: string, newSpotId: string, sleepType: SleepType) => {
    await supabase.from('assignments').delete().eq('night', night).eq('person_name', person);
    if (newSpotId) {
      await supabase.from('assignments').insert({ night, room_id: newSpotId, person_name: person, sleep_type: sleepType });
    }
  };

  const movePersonAcrossAllSelectedNights = async (person: string, newSpotId: string, sleepType: SleepType) => {
    // Determine which nights this person is staying
    const personRequest = requests.find(r => r.members.includes(person));
    const nights = personRequest ? personRequest.nights as Night[] : [hostNight];
    await supabase.from('assignments').delete().in('night', nights).eq('person_name', person);
    const rows = nights.map(n => ({ night: n, room_id: newSpotId, person_name: person, sleep_type: sleepType }));
    if (rows.length) await supabase.from('assignments').insert(rows);
  };

  const togglePlanLock = async () => {
    const newVal = planLocked ? 'false' : 'true';
    await supabase.from('settings').upsert({ key: 'plan_locked', value: newVal });
    flash(planLocked ? 'plan unlocked' : 'plan locked');
  };

  const addOutdoorSpot = async () => {
    if (!newSpotLabel.trim()) return flash('label required');
    const id = `${newSpotType}_${newSpotLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const { error } = await supabase.from('outdoor_spots').insert({
      id, spot_type: newSpotType, label: newSpotLabel.trim(), capacity: 99,
    });
    if (error) return flash('save failed');
    setNewSpotLabel('');
    flash('added');
  };

  const removeOutdoorSpot = async (id: string) => {
    if (!confirm('remove this spot? people in it will become unassigned.')) return;
    await supabase.from('outdoor_spots').delete().eq('id', id);
    NIGHTS.forEach(async n => {
      await supabase.from('assignments').delete().eq('night', n).eq('room_id', id);
    });
  };

  const removeRequest = async (req: Request) => {
    await supabase.from('requests').delete().eq('id', req.id);
    await supabase.from('assignments').delete().in('person_name', req.members);
  };

  const clearAssignments = async () => {
    if (!confirm('clear all assignments?')) return;
    await supabase.from('assignments').delete().neq('night', '___never___');
  };

  const resetAll = async () => {
    if (!confirm('wipe ALL requests AND assignments AND outdoor spots?')) return;
    await supabase.from('assignments').delete().neq('night', '___never___');
    await supabase.from('requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('outdoor_spots').delete().neq('id', '___never___');
  };

  const copyPlan = () => {
    let txt = `Forsthaus Korleput — sleeping plan\n\n`;
    NIGHTS.forEach(n => {
      txt += `=== ${NIGHT_LABEL[n].toUpperCase()} ===\n`;
      ROOMS.forEach(r => {
        const occ = (assignments[n] || {})[r.id] || [];
        txt += `Room ${r.name} (${r.beds}): ${occ.length ? occ.join(', ') : '—'}\n`;
      });
      outdoorSpots.forEach(o => {
        const occ = (assignments[n] || {})[o.id] || [];
        if (occ.length) txt += `${o.spot_type === 'tent' ? '⛺' : '🚐'} ${o.label}: ${occ.join(', ')}\n`;
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
      people.forEach(p => rows.push({ night: n, room_id: rid, person_name: p, sleep_type: 'house' }))
    ));
    if (rows.length) await supabase.from('assignments').insert(rows);
    setOptimizerNotes(allNotes);
  };

  // ============ DRAG HANDLERS ============

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const person = String(e.active.id);
    if (!canMove(person)) {
      flash(planLocked ? 'plan is locked by host' : `you can only move yourself${me ? '' : ' (set who you are first)'}`);
      return;
    }
    setActiveDrag(person);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!e.over) return;
    const person = String(e.active.id);
    const targetId = String(e.over.id);
    if (!canMove(person)) return;
    handleMove(person, targetId);
  };

  const handleMove = (person: string, targetId: string) => {
    // Determine the night & if target is a room or outdoor
    const room = ROOMS.find(r => r.id === targetId);
    const outdoor = outdoorSpots.find(o => o.id === targetId);
    if (!room && !outdoor) return;

    const currentNight = mapNight;
    const currentOccupants = (assignments[currentNight] || {})[targetId] || [];
    if (currentOccupants.includes(person)) { flash('already there'); return; }
    if (room && currentOccupants.length >= room.beds) {
      flash(`Room ${room.name} is full`);
      return;
    }
    const sleepType: SleepType = room ? 'house' : (outdoor!.spot_type as SleepType);
    setPersonSpot(currentNight, person, targetId, sleepType);
    const destName = room ? `Room ${room.name}` : outdoor!.label;
    flash(`✓ moved ${person} to ${destName}`);
  };

  // Tap-tap fallback
  const onChipTap = (person: string) => {
    if (!canMove(person)) {
      flash(planLocked ? 'plan is locked by host' : `you can only move yourself${me ? '' : ' (set who you are first)'}`);
      return;
    }
    setTapSelected(tapSelected === person ? null : person);
    if (tapSelected !== person) flash('now tap a destination');
  };
  const onTargetTap = (targetId: string) => {
    if (!tapSelected) return;
    handleMove(tapSelected, targetId);
    setTapSelected(null);
  };

  // ============ RENDER ============

  const totalSubs = requests.reduce((s, r) => s + r.members.length, 0);
  const headsForNight = (n: Night) =>
    requests.filter(r => r.nights.includes(n)).reduce((s, r) => s + r.members.length, 0);
  const bedsUsedForNight = (n: Night) =>
    Object.values(assignments[n] || {}).flat().length;

  const inHouse = (n: Night) => ROOMS.reduce((s, r) => s + ((assignments[n] || {})[r.id] || []).length, 0);
  const outside = (n: Night) => outdoorSpots.reduce((s, o) => s + ((assignments[n] || {})[o.id] || []).length, 0);
  const inTent = (n: Night) => outdoorSpots.filter(o => o.spot_type === 'tent').reduce((s, o) => s + ((assignments[n] || {})[o.id] || []).length, 0);
  const inCar = (n: Night) => outdoorSpots.filter(o => o.spot_type === 'car').reduce((s, o) => s + ((assignments[n] || {})[o.id] || []).length, 0);

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
        {requests.length} groups · {totalSubs} people · {NIGHT_LABEL[mapNight]}:{' '}
        {bedsUsedForNight(mapNight)} sleeping · {inHouse(mapNight)} in house · {inTent(mapNight)} tent · {inCar(mapNight)} car
      </div>

      {/* "me" indicator strip */}
      <div style={{
        background: me ? 'var(--info-bg)' : 'var(--surface-2)',
        color: me ? 'var(--info-fg)' : 'var(--text-2)',
        padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: 10,
        fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div>
          {me ? <>you are <strong>{me}</strong></> : <>tap "I'm…" so you can move yourself on the map</>}
          {planLocked && <span style={{ marginLeft: 8 }}><Pill style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}>🔒 plan locked</Pill></span>}
        </div>
        <button onClick={() => setShowMePicker(!showMePicker)} style={{
          fontSize: 11, padding: '4px 10px', background: 'transparent',
          border: '0.5px solid currentColor', borderRadius: 'var(--radius-md)', color: 'inherit',
        }}>{me ? 'change' : "I'm…"}</button>
      </div>

      {showMePicker && (
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>who are you? (you can only move yourself)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {allPeople.map(p => (
              <button key={p} onClick={() => { setMeAndStore(p); setShowMePicker(false); flash(`hi ${p}!`); }} style={{
                fontSize: 12, padding: '4px 10px', background: me === p ? 'var(--info-bg)' : 'var(--surface-2)',
                color: me === p ? 'var(--info-fg)' : 'var(--text)',
                border: '0.5px solid var(--border)', borderRadius: 999,
              }}>{p}</button>
            ))}
            {me && (
              <button onClick={() => { setMeAndStore(null); setShowMePicker(false); }} style={{
                fontSize: 12, padding: '4px 10px', background: 'transparent',
                color: 'var(--text-3)', border: '0.5px solid var(--border)', borderRadius: 999,
              }}>(forget me)</button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setSubTab('map')} style={tabStyle(subTab === 'map')}>map</button>
        {hostUnlocked && <button onClick={() => setSubTab('host')} style={tabStyle(subTab === 'host')}>host</button>}
      </div>

      {subTab === 'map' && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <NightTabs value={mapNight} onChange={setMapNight} showFull />

          {tapSelected && (
            <div style={{ background: 'var(--info-bg)', color: 'var(--info-fg)', padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: 10, fontSize: 12, textAlign: 'center' }}>
              <strong>{tapSelected}</strong> selected — tap a destination room/tent/car
              <button onClick={() => setTapSelected(null)} style={{ marginLeft: 10, background: 'transparent', border: '0.5px solid currentColor', borderRadius: 'var(--radius-md)', color: 'inherit', fontSize: 11, padding: '2px 8px' }}>cancel</button>
            </div>
          )}

          <FloorPlan floor="OG" rooms={ROOMS.filter(r => r.floor === 'OG')} statics={STATIC_OG}
            assignments={assignments[mapNight]} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom}
            me={me} canMove={canMove} tapSelected={tapSelected} onChipTap={onChipTap} onTargetTap={onTargetTap}
            activeDrag={activeDrag}
          />
          <FloorPlan floor="EG" rooms={ROOMS.filter(r => r.floor === 'EG')} statics={STATIC_EG}
            assignments={assignments[mapNight]} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom}
            me={me} canMove={canMove} tapSelected={tapSelected} onChipTap={onChipTap} onTargetTap={onTargetTap}
            activeDrag={activeDrag}
          />
          <Legend />

          <OutdoorSection
            spots={outdoorSpots}
            assignments={assignments[mapNight]}
            me={me} canMove={canMove} tapSelected={tapSelected}
            onChipTap={onChipTap} onTargetTap={onTargetTap}
            activeDrag={activeDrag}
          />

          <RoomDetail
            room={selectedRoom ? ROOMS.find(r => r.id === selectedRoom) || null : null}
            outdoor={selectedRoom ? outdoorSpots.find(o => o.id === selectedRoom) || null : null}
            assignments={assignments}
          />

          <DragOverlay>
            {activeDrag ? <Chip>{activeDrag}</Chip> : null}
          </DragOverlay>
        </DndContext>
      )}

      {subTab === 'host' && hostUnlocked && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <PrimaryBtn onClick={runOptimizer}>run optimizer (all nights)</PrimaryBtn>
            <GhostBtn onClick={togglePlanLock}>{planLocked ? '🔒 unlock plan' : '🔓 lock plan'}</GhostBtn>
            <GhostBtn onClick={clearAssignments}>clear assignments</GhostBtn>
            <GhostBtn onClick={resetAll} danger>reset all</GhostBtn>
            <GhostBtn onClick={copyPlan}>copy plan</GhostBtn>
          </div>

          {optimizerNotes.length > 0 && (
            <div style={{ background: 'var(--info-bg)', color: 'var(--info-fg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 14 }}>
              {optimizerNotes.map((n, i) => <div key={i}>· {n}</div>)}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 500, margin: '14px 0 4px' }}>add an outdoor spot</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <select value={newSpotType} onChange={e => setNewSpotType(e.target.value as any)} style={{
              padding: '8px 10px', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface)',
            }}>
              <option value="tent">⛺ tent</option>
              <option value="car">🚐 car/van</option>
            </select>
            <input type="text" value={newSpotLabel} onChange={e => setNewSpotLabel(e.target.value)}
              placeholder="e.g. Diego's tent, Marco's van" style={{ flex: 1 }} />
            <PrimaryBtn onClick={addOutdoorSpot}>add</PrimaryBtn>
          </div>
          {outdoorSpots.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              {outdoorSpots.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: 'var(--text-2)', borderBottom: '0.5px solid var(--border)' }}>
                  <span>{o.spot_type === 'tent' ? '⛺' : '🚐'} {o.label}</span>
                  <button onClick={() => removeOutdoorSpot(o.id)} style={{
                    padding: '2px 6px', background: 'transparent', color: 'var(--danger-fg)',
                    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 10,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>requests ({requests.length})</div>
          <div style={{ marginBottom: 18 }}>
            {requests.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>none yet — add via Supabase table editor or run optimizer with existing data</div>
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
          <ManualList night={hostNight} requests={requests} assignments={assignments}
            outdoorSpots={outdoorSpots} onChange={setPersonSpot} />
        </>
      )}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', border: '0.5px solid var(--border)',
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-2)',
    borderRadius: 'var(--radius-md)', fontSize: 13,
  };
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

// ============ DRAGGABLE CHIP ============
function DraggableChip({ person, isMe, isSelected, canMove, onTap }: {
  person: string; isMe: boolean; isSelected: boolean;
  canMove: boolean; onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: person,
    disabled: !canMove,
  });
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
    padding: '3px 8px', borderRadius: 999,
    background: isMe ? 'var(--info-bg)' : 'var(--surface-2)',
    color: isMe ? 'var(--info-fg)' : 'var(--text-2)',
    margin: '2px 3px',
    border: isSelected ? '2px solid var(--info-fg)' : isMe ? '1px solid var(--info-fg)' : '1px solid transparent',
    fontWeight: isMe ? 500 : 400,
    cursor: canMove ? (isDragging ? 'grabbing' : 'grab') : 'default',
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
    userSelect: 'none',
  };
  return (
    <span ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={(e) => { e.stopPropagation(); onTap(); }}>
      {person}
    </span>
  );
}

// ============ DROPPABLE ROOM (in SVG) ============
function DroppableRoomBg({ room, occ, isSelected, onClick, children }: {
  room: Room; occ: number; isSelected: boolean; onClick: () => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: room.id });
  let fill = '#EAF3DE'; let stroke = '#3B6D11';
  if (occ >= room.beds) { fill = '#FCEBEB'; stroke = '#A32D2D'; }
  else if (occ > 0) { fill = '#FAEEDA'; stroke = '#854F0B'; }
  const sw = isSelected ? 3 : isOver ? 3 : 1;
  const dashArray = isOver ? '5,3' : undefined;
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      <rect ref={setNodeRef as any} x={room.x} y={room.y} width={room.w} height={room.h} rx={4}
        style={{ fill, stroke, strokeWidth: sw, transition: 'all 0.15s', strokeDasharray: dashArray }} />
      <text x={room.x + room.w / 2} y={room.y + 14}
        style={{ fontSize: 13, fontWeight: 500, textAnchor: 'middle', pointerEvents: 'none' }}>{room.name}</text>
      <text x={room.x + room.w / 2} y={room.y + 26}
        style={{ fontSize: 10, textAnchor: 'middle', pointerEvents: 'none', fill: 'var(--text-2)' }}>
        {occ}/{room.beds}
      </text>
      {children}
    </g>
  );
}

// ============ FLOOR PLAN ============
function FloorPlan({ floor, rooms, statics, assignments, selectedRoom, onSelectRoom,
  me, canMove, tapSelected, onChipTap, onTargetTap, activeDrag,
}: {
  floor: 'OG' | 'EG'; rooms: Room[]; statics: any[];
  assignments: Record<string, string[]>; selectedRoom: string | null;
  onSelectRoom: (id: string) => void;
  me: string | null; canMove: (p: string) => boolean;
  tapSelected: string | null; onChipTap: (p: string) => void; onTargetTap: (id: string) => void;
  activeDrag: string | null;
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
          return (
            <DroppableRoomBg key={r.id} room={r} occ={occ}
              isSelected={selectedRoom === r.id}
              onClick={() => { if (tapSelected) onTargetTap(r.id); else onSelectRoom(r.id); }} />
          );
        })}
      </svg>

      {/* Chips below the svg (easier to drag than embedded foreignObject) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginBottom: 14 }}>
        {rooms.map(r => {
          const occupants = (assignments[r.id] || []);
          if (occupants.length === 0) return null;
          return (
            <DroppableMiniCard key={r.id} id={r.id} title={`Room ${r.name}`} subtitle={`${occupants.length}/${r.beds}`}>
              {occupants.map(p => (
                <DraggableChip key={p} person={p} isMe={p === me}
                  isSelected={tapSelected === p} canMove={canMove(p)}
                  onTap={() => onChipTap(p)} />
              ))}
            </DroppableMiniCard>
          );
        })}
      </div>
    </>
  );
}

// Mini card that's both droppable + shows occupants. Used below SVG for easy chip manipulation.
function DroppableMiniCard({ id, title, subtitle, children }: {
  id: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{
      background: isOver ? 'var(--info-bg)' : 'var(--surface)',
      border: isOver ? '2px dashed var(--info-fg)' : '0.5px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '6px 8px',
      transition: 'all 0.15s', minHeight: 50,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Legend() {
  const item = (color: string, border: string, label: string) => (
    <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, border: `1px solid ${border}`, marginRight: 4, verticalAlign: 'middle' }} />{label}</span>
  );
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text-2)', marginTop: 6, marginBottom: 6, flexWrap: 'wrap' }}>
      {item('#EAF3DE', '#3B6D11', 'empty')} {item('#FAEEDA', '#854F0B', 'partial')} {item('#FCEBEB', '#A32D2D', 'full')}
    </div>
  );
}

// ============ OUTDOOR SECTION ============
function OutdoorSection({ spots, assignments, me, canMove, tapSelected, onChipTap, onTargetTap, activeDrag }: {
  spots: OutdoorSpot[]; assignments: Record<string, string[]>;
  me: string | null; canMove: (p: string) => boolean;
  tapSelected: string | null; onChipTap: (p: string) => void;
  onTargetTap: (id: string) => void; activeDrag: string | null;
}) {
  if (spots.length === 0) {
    return (
      <div style={{
        marginTop: 18, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)',
        textAlign: 'center', fontSize: 12, color: 'var(--text-3)',
      }}>
        ⛺ no tents or cars yet · host can add them under host mode
      </div>
    );
  }
  return (
    <div style={{ marginTop: 24, paddingTop: 18, borderTop: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'lowercase', letterSpacing: '0.04em', marginBottom: 10 }}>
        ⛺ outside the house
      </div>
      {spots.map(o => {
        const occupants = (assignments[o.id] || []);
        return (
          <DroppableOutdoorCard key={o.id} spot={o} occupants={occupants}
            me={me} canMove={canMove} tapSelected={tapSelected}
            onChipTap={onChipTap} onTargetTap={onTargetTap} />
        );
      })}
    </div>
  );
}

function DroppableOutdoorCard({ spot, occupants, me, canMove, tapSelected, onChipTap, onTargetTap }: {
  spot: OutdoorSpot; occupants: string[];
  me: string | null; canMove: (p: string) => boolean;
  tapSelected: string | null; onChipTap: (p: string) => void; onTargetTap: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: spot.id });
  return (
    <div ref={setNodeRef}
      onClick={() => { if (tapSelected) onTargetTap(spot.id); }}
      style={{
        background: isOver ? 'var(--info-bg)' : 'var(--surface)',
        border: isOver ? '2px dashed var(--info-fg)' : '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: 8,
        transition: 'all 0.15s',
        cursor: tapSelected ? 'pointer' : 'default',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>
          {spot.spot_type === 'tent' ? '⛺' : '🚐'} {spot.label}
        </div>
        <Pill>{occupants.length} {occupants.length === 1 ? 'person' : 'people'}</Pill>
      </div>
      <div>
        {occupants.length === 0
          ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>empty</span>
          : occupants.map(p => (
            <DraggableChip key={p} person={p} isMe={p === me}
              isSelected={tapSelected === p} canMove={canMove(p)}
              onTap={() => onChipTap(p)} />
          ))}
      </div>
    </div>
  );
}

function RoomDetail({ room, outdoor, assignments }: {
  room: Room | null; outdoor: OutdoorSpot | null; assignments: AssignMap;
}) {
  if (!room && !outdoor) return null;
  const id = room ? room.id : outdoor!.id;
  const title = room ? `Room ${room.name}` : `${outdoor!.spot_type === 'tent' ? '⛺' : '🚐'} ${outdoor!.label}`;
  const sub = room ? `${room.floor === 'OG' ? 'upstairs' : 'ground floor'} · ${room.beds} beds · ${room.note}` : 'outdoor';
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginTop: 16 }}>
      <div style={{ fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{sub}</div>
      {NIGHTS.map(n => {
        const occ = (assignments[n] || {})[id] || [];
        return (
          <div key={n} style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{NIGHT_LABEL[n]}</span>{' '}
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({occ.length}{room ? `/${room.beds}` : ''})</span>
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

function ManualList({ night, requests, assignments, outdoorSpots, onChange }: {
  night: Night; requests: Request[]; assignments: AssignMap;
  outdoorSpots: OutdoorSpot[];
  onChange: (n: Night, p: string, spotId: string, type: SleepType) => void;
}) {
  const people: { name: string; lead: string }[] = [];
  requests.forEach(r => { if (r.nights.includes(night)) r.members.forEach(m => people.push({ name: m, lead: r.lead })); });
  if (!people.length) return <div style={{ fontSize: 13, color: 'var(--text-3)' }}>no one is staying this night</div>;
  const personSpot: Record<string, string> = {};
  Object.entries(assignments[night] || {}).forEach(([rid, names]) => names.forEach(n => personSpot[n] = rid));
  return (
    <div>
      {people.map(p => {
        const current = personSpot[p.name];
        return (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 500 }}>{p.name}</span> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>· {p.lead}</span>
            </div>
            <select value={current || ''} onChange={e => {
              const v = e.target.value;
              if (!v) return;
              const room = ROOMS.find(r => r.id === v);
              const outdoor = outdoorSpots.find(o => o.id === v);
              const type: SleepType = room ? 'house' : outdoor ? (outdoor.spot_type as SleepType) : 'house';
              onChange(night, p.name, v, type);
            }} style={{ padding: '4px 8px', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
              <option value="">—</option>
              <optgroup label="House">
                {ROOMS.map(r => {
                  const occ = ((assignments[night] || {})[r.id] || []).length;
                  const isCurrent = current === r.id;
                  return <option key={r.id} value={r.id} disabled={occ >= r.beds && !isCurrent}>Room {r.name} ({occ}/{r.beds})</option>;
                })}
              </optgroup>
              {outdoorSpots.length > 0 && (
                <optgroup label="Outside">
                  {outdoorSpots.map(o => {
                    const occ = ((assignments[night] || {})[o.id] || []).length;
                    return <option key={o.id} value={o.id}>{o.spot_type === 'tent' ? '⛺' : '🚐'} {o.label} ({occ})</option>;
                  })}
                </optgroup>
              )}
            </select>
          </div>
        );
      })}
    </div>
  );
}
