/**
 * glass.ts — reusable Glassmorphism / Neumorphism / Liquid-Glass style helpers.
 * Drop these into any `style={...}` to give a surface the modern frosted look.
 * All return React.CSSProperties (include -webkit- prefixes for Safari).
 */
import type { CSSProperties } from 'react';

const rgb = (hex: string): string => {
  const c = hex.replace('#', '');
  return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`;
};

/** Glassmorphism — translucent frosted panel with backdrop blur. */
export function glass(accent = '#00f5ff', radius = 16): CSSProperties {
  return {
    background: 'rgba(255,255,255,0.055)',
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: radius,
    boxShadow: `0 8px 32px rgba(0,0,0,0.37), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(${rgb(accent)},0.04)`,
  };
}

/** Neumorphism — soft extruded (raised) or pressed (inset) surface. */
export function neu(radius = 18, raised = true): CSSProperties {
  return {
    background: 'linear-gradient(145deg, #101c33, #0a1320)',
    borderRadius: radius,
    border: '1px solid rgba(255,255,255,0.04)',
    boxShadow: raised
      ? '7px 7px 16px rgba(0,0,0,0.55), -6px -6px 16px rgba(70,95,140,0.10)'
      : 'inset 5px 5px 12px rgba(0,0,0,0.6), inset -5px -5px 12px rgba(70,95,140,0.10)',
  };
}

/** Liquid Glass — Apple-style: heavier blur, specular highlight, accent bleed. */
export function liquidGlass(accent = '#00f5ff', radius = 22): CSSProperties {
  return {
    background: `linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.045) 42%, rgba(${rgb(accent)},0.10) 100%)`,
    backdropFilter: 'blur(22px) saturate(180%) brightness(1.06)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%) brightness(1.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: radius,
    boxShadow: `0 14px 44px rgba(0,0,0,0.45), inset 0 1.5px 1px rgba(255,255,255,0.4), inset 0 -10px 28px rgba(${rgb(accent)},0.07)`,
    position: 'relative',
    overflow: 'hidden',
  };
}

/** A neumorphic progress track + fill colour. */
export function neuProgressTrack(): CSSProperties {
  return {
    height: 9, borderRadius: 999, background: '#0a1320',
    boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(70,95,140,0.08)',
    overflow: 'hidden',
  };
}
export function progressFill(pct: number, accent: string): CSSProperties {
  return {
    height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 999,
    background: `linear-gradient(90deg, rgba(${rgb(accent)},0.55), ${accent})`,
    boxShadow: `0 0 12px rgba(${rgb(accent)},0.6)`,
  };
}

export const glassHex = rgb;
