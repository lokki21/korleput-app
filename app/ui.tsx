'use client';
import React from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <label style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</div>}
    </div>
  );
}

export function GhostBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '6px 10px', background: 'transparent',
      border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
      color: danger ? 'var(--danger-fg)' : 'var(--text-2)',
    }}>{children}</button>
  );
}

export function PrimaryBtn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 16px', background: '#1a1a1a', color: '#fff', border: 0,
      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500,
      opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
      padding: '3px 8px', borderRadius: 999, background: 'var(--surface-2)',
      color: 'var(--text-2)', margin: '2px 4px 2px 0',
    }}>{children}</span>
  );
}

export function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 7px', borderRadius: 999,
      background: 'var(--surface-2)', color: 'var(--text-2)', ...style,
    }}>{children}</span>
  );
}

export function NightsPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 999,
      background: 'var(--info-bg)', color: 'var(--info-fg)', marginLeft: 4,
    }}>{children}</span>
  );
}

export function Seg({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, minWidth: 80, padding: 8, border: '0.5px solid var(--border)',
          background: value === o.v ? 'var(--info-bg)' : 'transparent',
          color: value === o.v ? 'var(--info-fg)' : 'var(--text)',
          borderColor: value === o.v ? 'var(--info-fg)' : 'var(--border)',
          borderRadius: 'var(--radius-md)', fontSize: 13,
        }}>{o.label}</button>
      ))}
    </div>
  );
}

export function MultiSelect({ values, onChange, options }: {
  values: Set<string>; onChange: (s: Set<string>) => void;
  options: { v: string; label: string; sub?: string }[];
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
      {options.map(o => {
        const sel = values.has(o.v);
        return (
          <button key={o.v} onClick={() => {
            const next = new Set(values);
            if (sel) next.delete(o.v); else next.add(o.v);
            onChange(next);
          }} style={{
            padding: '10px 6px', border: '0.5px solid var(--border)',
            background: sel ? 'var(--info-bg)' : 'transparent',
            color: sel ? 'var(--info-fg)' : 'var(--text)',
            borderColor: sel ? 'var(--info-fg)' : 'var(--border)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column',
            gap: 2, fontSize: 13,
          }}>
            <span>{o.label}</span>
            {o.sub && <span style={{ fontSize: 10, opacity: 0.7 }}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { v: T; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '8px 14px', border: '0.5px solid var(--border)',
          background: value === o.v ? 'var(--surface-2)' : 'transparent',
          color: value === o.v ? 'var(--text)' : 'var(--text-2)',
          borderColor: value === o.v ? 'var(--border-2)' : 'var(--border)',
          borderRadius: 'var(--radius-md)', fontSize: 14,
        }}>{o.label}</button>
      ))}
    </div>
  );
}
