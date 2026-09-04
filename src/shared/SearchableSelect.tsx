/**
 * SearchableSelect - platform-wide drop-in replacement for the native
 * <select>/<option> pair. Same call shape (value, onChange, <option>
 * children) so any existing `<select ...>{options}</select>` block can be
 * converted by renaming the two tags - no restructuring of the option list.
 *
 * Adds what a native select can't: type-to-filter search over the option
 * labels, so a long list (regions, road links, station names, etc.) doesn't
 * force scrolling through everything to find one entry.
 *
 *   <SearchableSelect value={mode} onChange={setMode}>
 *     <option value="adt">Traffic Delay (ADT)</option>
 *     <option value="surface">Surface Type</option>
 *   </SearchableSelect>
 */
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';

interface OptEntry { value: string; label: string; }

function extractOptions(children: React.ReactNode): OptEntry[] {
  const out: OptEntry[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    if (child.type === 'optgroup') {
      out.push(...extractOptions(props.children as React.ReactNode));
      return;
    }
    const label = typeof props.children === 'string' || typeof props.children === 'number'
      ? String(props.children)
      : String(props.value ?? '');
    out.push({ value: String(props.value ?? ''), label });
  });
  return out;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Rendered in the input while open and no query typed yet. */
  placeholder?: string;
}

export function SearchableSelect({ value, onChange, children, style, disabled, placeholder }: Props) {
  const options = useMemo(() => extractOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => { setHighlight(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  function commit(opt: OptEntry) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openList(); return; }
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) commit(filtered[highlight]);
      else openList();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={openList}
        style={{
          ...style,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? selected?.label ?? 'Search…'}
            autoFocus
            style={{
              background: 'transparent', border: 'none', outline: 'none', color: 'inherit',
              font: 'inherit', width: '100%', minWidth: 60,
            }}
          />
        ) : (
          <span
            onKeyDown={onKeyDown}
            tabIndex={disabled ? -1 : 0}
            onFocus={openList}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {selected?.label ?? value}
          </span>
        )}
        <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0, marginLeft: 2 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', width: 'max-content',
          maxWidth: 320, maxHeight: 240, overflowY: 'auto', background: '#0b1220',
          border: '1px solid rgba(148,163,184,0.28)', borderRadius: 7, zIndex: 60,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '8px 11px', fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>No matches</div>
          )}
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); commit(o); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '7px 11px', fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap',
                background: i === highlight ? 'rgba(77,159,255,0.16)' : 'transparent',
                color: o.value === value ? '#4d9fff' : '#e2eaf4', fontWeight: o.value === value ? 700 : 400,
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
