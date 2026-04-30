/**
 * BridgeSchematic — SVG side-elevation "digital twin" of a bridge or culvert.
 * Drawn from structure properties: spans, piers, material, crossing type, condition.
 * Defects shown as animated hotspots. Hover for defect tooltip.
 */

import { useState } from 'react';
import type { Structure } from '../../types';
import { conditionColor, conditionLabel, CONDITION_COLORS } from '../../utils/helpers';

interface Props { structure: Structure }

// Canvas constants
const W = 900;
const H = 380;

// Layout zones (y coordinates)
const SKY_H      = 160;   // sky zone height
const DECK_Y     = 155;   // top of parapet
const PARAPET_H  = 18;    // parapet wall height
const BEAM_Y     = DECK_Y + PARAPET_H;  // bottom of deck slab
const SLAB_H     = 14;    // deck slab thickness
const GIRDER_H   = 22;    // girder depth below slab
const WATER_Y    = 258;   // water surface (river crossings)
const BED_Y      = 295;   // river bed / ground
const GROUND_Y   = BED_Y;
const FOUND_Y    = BED_Y + 25; // foundation bottom

// Horizontal layout
const MARGIN_L  = 65;
const MARGIN_R  = 65;
const DECK_X1   = MARGIN_L;
const DECK_X2   = W - MARGIN_R;
const DECK_W    = DECK_X2 - DECK_X1;

// Derived component dimensions
const ABT_W     = 44;   // abutment width
const ABT_H     = GROUND_Y - BEAM_Y + SLAB_H + GIRDER_H;
const PIER_W    = 18;
const PIER_CAP_W = 30;
const PIER_CAP_H = 10;

// Span area between abutment inner faces
const SPAN_X1   = DECK_X1 + ABT_W;
const SPAN_X2   = DECK_X2 - ABT_W;
const SPAN_AVAIL = SPAN_X2 - SPAN_X1;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Map defect names to bridge components
const DEFECT_ZONES: Record<string, { label: string; zone: 'deck'|'parapet'|'girder'|'pier'|'abutment'|'channel' }> = {
  'Deck cracking':          { label: 'Deck cracking',          zone: 'deck' },
  'Spalling concrete':      { label: 'Spalling concrete',      zone: 'deck' },
  'Rebar exposure':         { label: 'Rebar exposure',         zone: 'girder' },
  'Efflorescence':          { label: 'Efflorescence',          zone: 'pier' },
  'Scour at foundations':   { label: 'Scour at foundations',   zone: 'channel' },
  'Guard rail damage':      { label: 'Guard rail damage',      zone: 'parapet' },
  'Bearing deterioration':  { label: 'Bearing deterioration',  zone: 'girder' },
  'Expansion joint failure':{ label: 'Expansion joint failure',zone: 'deck' },
  'Drainage blockage':      { label: 'Drainage blockage',      zone: 'deck' },
  'Deformation/settlement': { label: 'Deformation/settlement', zone: 'abutment' },
  'Parapet damage':         { label: 'Parapet damage',         zone: 'parapet' },
  'Paint deterioration':    { label: 'Paint deterioration',    zone: 'pier' },
  'Corrosion of steel':     { label: 'Corrosion of steel',     zone: 'girder' },
  'Wingwall cracking':      { label: 'Wingwall cracking',      zone: 'abutment' },
  'Approach slab settlement':{ label: 'Approach slab settlement',zone: 'abutment' },
  'Erosion at abutments':   { label: 'Erosion at abutments',   zone: 'channel' },
  'Loss of bearing area':   { label: 'Loss of bearing area',   zone: 'girder' },
  'Honeycomb concrete':     { label: 'Honeycomb concrete',     zone: 'deck' },
  'Alkali–silica reaction': { label: 'Alkali–silica reaction', zone: 'deck' },
  'Debris accumulation':    { label: 'Debris accumulation',    zone: 'channel' },
};

function zoneY(zone: string): number {
  switch (zone) {
    case 'deck':      return BEAM_Y - 4;
    case 'parapet':   return DECK_Y + 6;
    case 'girder':    return BEAM_Y + SLAB_H + GIRDER_H / 2;
    case 'pier':      return WATER_Y - 20;
    case 'abutment':  return BEAM_Y + ABT_H / 2;
    case 'channel':   return BED_Y + 15;
    default:          return H / 2;
  }
}

function zoneX(zone: string, pieced: number[], spanX1: number, spanX2: number): number {
  switch (zone) {
    case 'deck':      return (spanX1 + spanX2) / 2;
    case 'parapet':   return spanX1 + (spanX2 - spanX1) * 0.3;
    case 'girder':    return (spanX1 + spanX2) / 2 + 30;
    case 'pier':      return pieced.length > 0 ? pieced[Math.floor(pieced.length / 2)] : (spanX1 + spanX2) / 2;
    case 'abutment':  return DECK_X1 + ABT_W / 2;
    case 'channel':   return (spanX1 + spanX2) / 2;
    default:          return W / 2;
  }
}

export default function BridgeSchematic({ structure: s }: Props) {
  const [hoveredDefect, setHoveredDefect] = useState<string | null>(null);

  const condCol    = conditionColor(s.conditionRating);
  const condDark   = condCol + 'bb';
  const nSpans     = clamp(s.noOfSpans  || 1, 1, 12);
  const nPiers     = Math.max(0, nSpans - 1);
  const isRiver    = (s.crossingType || '').toLowerCase().includes('river') ||
                     (s.crossingType || '').toLowerCase().includes('stream') ||
                     !!s.river;
  const isCulvert  = s.type === 'culvert';
  const isSteel    = (s.material || '').toLowerCase().includes('steel') ||
                     (s.material || '').toLowerCase().includes('truss');
  const isPrestress = (s.material || '').toLowerCase().includes('prestress');

  // Per-span width
  const spanW = SPAN_AVAIL / nSpans;

  // Pier x-positions (at span junctions)
  const pierXs: number[] = [];
  for (let i = 1; i < nSpans; i++) {
    pierXs.push(SPAN_X1 + i * spanW);
  }

  // Defect hotspot positions
  const defectHotspots = s.defects.map((d, i) => {
    const zone = DEFECT_ZONES[d]?.zone ?? 'deck';
    const x    = zoneX(zone, pierXs, SPAN_X1, SPAN_X2) + (i % 3) * 40 - 20;
    const y    = zoneY(zone);
    return { d, x: clamp(x, 30, W - 30), y, zone };
  });

  // Condition-based material color variants
  const deckFill   = condCol + '99';
  const concFill   = conditionRating5to1Fill(s.conditionRating);
  const girderFill = isSteel ? '#94a3b8' : condDark;

  // Scale label text for total length
  const totalLen = (s.spanLength * nSpans).toFixed(0);
  const age      = 2024 - s.yearBuilt;

  return (
    <div className="relative w-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden select-none">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-bold text-white">Digital Twin — Side Elevation</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>{nSpans} span{nSpans > 1 ? 's' : ''}</span>
          <span>{nPiers} pier{nPiers !== 1 ? 's' : ''}</span>
          <span>~{totalLen} m total</span>
          <span style={{ color: condCol }} className="font-bold">
            Condition {s.conditionRating}/5 — {conditionLabel(s.conditionRating)}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <defs>
          {/* Sky gradient */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          {/* Water gradient */}
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1e3a5f" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0f2744" />
          </linearGradient>
          {/* Ground gradient */}
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#422006" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#292524" />
          </linearGradient>
          {/* Concrete texture gradient */}
          <linearGradient id="concGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={concFill} stopOpacity="0.95" />
            <stop offset="100%" stopColor={concFill} stopOpacity="0.7" />
          </linearGradient>
          {/* Condition glow filter */}
          <filter id="condGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Defect pulse */}
          <filter id="defectGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ─── Background sky ─── */}
        <rect x={0} y={0} width={W} height={H} fill="url(#skyGrad)" />

        {/* Engineering grid */}
        <g opacity={0.06} stroke="#94a3b8" strokeWidth={0.5}>
          {Array.from({ length: 18 }, (_, i) => (
            <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 50} x2={W} y2={i * 50} />
          ))}
        </g>

        {/* ─── Approach road (left) ─── */}
        <rect x={0} y={DECK_Y - 2} width={DECK_X1} height={PARAPET_H + 4} fill="#374151" />
        {/* ─── Approach road (right) ─── */}
        <rect x={DECK_X2} y={DECK_Y - 2} width={W - DECK_X2} height={PARAPET_H + 4} fill="#374151" />

        {/* ─── Road surface markings ─── */}
        <rect x={2} y={DECK_Y + 4} width={DECK_X1 - 6} height={3} fill="#fbbf24" opacity={0.4} />
        <rect x={DECK_X2 + 4} y={DECK_Y + 4} width={W - DECK_X2 - 6} height={3} fill="#fbbf24" opacity={0.4} />

        {/* ─── River / ground ─── */}
        {isRiver ? (
          <>
            {/* River banks */}
            <rect x={0} y={WATER_Y} width={W} height={H - WATER_Y} fill="url(#groundGrad)" />
            {/* River water */}
            <rect x={DECK_X1 + ABT_W - 10} y={WATER_Y} width={SPAN_AVAIL + 20} height={BED_Y - WATER_Y} fill="url(#waterGrad)" />
            {/* Water surface ripple lines */}
            {[0, 1, 2].map(i => (
              <line key={i}
                x1={SPAN_X1 + 20 + i * 60} y1={WATER_Y + 8 + i * 5}
                x2={SPAN_X1 + 60 + i * 60} y2={WATER_Y + 8 + i * 5}
                stroke="#60a5fa" strokeWidth={1} opacity={0.3}
              />
            ))}
            {/* River bed */}
            <rect x={SPAN_X1 - 10} y={BED_Y} width={SPAN_AVAIL + 20} height={8} fill="#92400e" opacity={0.6} />
          </>
        ) : (
          /* Ground (road / non-river) */
          <rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill="url(#groundGrad)" />
        )}

        {/* ─── Left abutment ─── */}
        <rect
          x={DECK_X1} y={BEAM_Y + SLAB_H}
          width={ABT_W} height={ABT_H - SLAB_H}
          fill="url(#concGrad)" stroke={condCol} strokeWidth={1} opacity={0.9}
        />
        {/* Left abutment cap */}
        <rect x={DECK_X1 - 6} y={BEAM_Y + SLAB_H} width={ABT_W + 12} height={8} fill={concFill} opacity={0.95} />
        {/* Left foundation */}
        <rect x={DECK_X1 - 10} y={GROUND_Y + 5} width={ABT_W + 20} height={15} fill="#475569" opacity={0.8} />
        {/* Left wingwall */}
        <polygon
          points={`${DECK_X1},${BEAM_Y + SLAB_H} ${DECK_X1 - 20},${GROUND_Y} ${DECK_X1},${GROUND_Y}`}
          fill={concFill} opacity={0.5}
        />

        {/* ─── Right abutment ─── */}
        <rect
          x={DECK_X2 - ABT_W} y={BEAM_Y + SLAB_H}
          width={ABT_W} height={ABT_H - SLAB_H}
          fill="url(#concGrad)" stroke={condCol} strokeWidth={1} opacity={0.9}
        />
        <rect x={DECK_X2 - ABT_W - 6} y={BEAM_Y + SLAB_H} width={ABT_W + 12} height={8} fill={concFill} opacity={0.95} />
        <rect x={DECK_X2 - ABT_W - 10} y={GROUND_Y + 5} width={ABT_W + 20} height={15} fill="#475569" opacity={0.8} />
        <polygon
          points={`${DECK_X2},${BEAM_Y + SLAB_H} ${DECK_X2 + 20},${GROUND_Y} ${DECK_X2},${GROUND_Y}`}
          fill={concFill} opacity={0.5}
        />

        {/* ─── Piers ─── */}
        {pierXs.map((px, i) => {
          const pierTop    = BEAM_Y + SLAB_H + GIRDER_H + 4;
          const pierBottom = isRiver ? BED_Y : GROUND_Y;
          const pierHeight = pierBottom - pierTop;
          return (
            <g key={i}>
              {/* Pier cap */}
              <rect
                x={px - PIER_CAP_W / 2} y={pierTop - PIER_CAP_H}
                width={PIER_CAP_W} height={PIER_CAP_H}
                fill={concFill} stroke={condCol} strokeWidth={0.8} rx={2}
              />
              {/* Pier shaft */}
              <rect
                x={px - PIER_W / 2} y={pierTop}
                width={PIER_W} height={pierHeight}
                fill="url(#concGrad)" stroke={condCol} strokeWidth={0.8}
              />
              {/* Pile cap */}
              <rect
                x={px - PIER_CAP_W / 2 - 4} y={pierBottom}
                width={PIER_CAP_W + 8} height={12}
                fill="#475569" opacity={0.8} rx={2}
              />
            </g>
          );
        })}

        {/* ─── Span girders (under deck) ─── */}
        {Array.from({ length: nSpans }, (_, i) => {
          const gx1 = SPAN_X1 + i * spanW + 2;
          const gx2 = SPAN_X1 + (i + 1) * spanW - 2;
          const gw  = gx2 - gx1;

          return (
            <g key={i}>
              {isCulvert ? (
                /* Box culvert opening */
                <>
                  <rect x={gx1} y={BEAM_Y + SLAB_H} width={gw} height={GIRDER_H + 30}
                    fill="none" stroke={girderFill} strokeWidth={2} />
                  <text x={(gx1 + gx2) / 2} y={BEAM_Y + SLAB_H + GIRDER_H + 18}
                    textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">
                    ■ BOX
                  </text>
                </>
              ) : isSteel ? (
                /* Steel truss / girder */
                <>
                  {/* Top chord */}
                  <line x1={gx1} y1={BEAM_Y + SLAB_H} x2={gx2} y2={BEAM_Y + SLAB_H} stroke={girderFill} strokeWidth={3} />
                  {/* Bottom chord */}
                  <line x1={gx1} y1={BEAM_Y + SLAB_H + GIRDER_H} x2={gx2} y2={BEAM_Y + SLAB_H + GIRDER_H} stroke={girderFill} strokeWidth={3} />
                  {/* Diagonals */}
                  {Array.from({ length: Math.max(2, Math.floor(gw / 25)) }, (_, j) => {
                    const dx = gw / Math.max(2, Math.floor(gw / 25));
                    const x0 = gx1 + j * dx;
                    const x1b = x0 + dx;
                    return (
                      <line key={j} x1={x0} y1={BEAM_Y + SLAB_H} x2={x1b} y2={BEAM_Y + SLAB_H + GIRDER_H}
                        stroke={girderFill} strokeWidth={1.5} opacity={0.7} />
                    );
                  })}
                  {/* Verticals */}
                  <line x1={gx1} y1={BEAM_Y + SLAB_H} x2={gx1} y2={BEAM_Y + SLAB_H + GIRDER_H} stroke={girderFill} strokeWidth={2} />
                  <line x1={gx2} y1={BEAM_Y + SLAB_H} x2={gx2} y2={BEAM_Y + SLAB_H + GIRDER_H} stroke={girderFill} strokeWidth={2} />
                </>
              ) : (
                /* Concrete I-beam / prestressed girders */
                <>
                  {/* Flanges + web I-profile */}
                  <rect x={gx1} y={BEAM_Y + SLAB_H}        width={gw} height={4}             fill={girderFill} opacity={0.9} />
                  <rect x={gx1} y={BEAM_Y + SLAB_H + GIRDER_H - 4} width={gw} height={4}     fill={girderFill} opacity={0.9} />
                  <rect x={gx1 + gw * 0.2} y={BEAM_Y + SLAB_H + 4} width={gw * 0.6} height={GIRDER_H - 8} fill={girderFill} opacity={0.5} />
                  {/* Prestress strand indicators */}
                  {isPrestress && Array.from({ length: 3 }, (_, k) => (
                    <circle key={k} cx={gx1 + gw * (0.25 + k * 0.25)} cy={BEAM_Y + SLAB_H + GIRDER_H - 6}
                      r={2} fill="#fbbf24" opacity={0.8} />
                  ))}
                </>
              )}
              {/* Span dimension tick */}
              <line x1={(gx1 + gx2) / 2} y1={DECK_Y - 12} x2={(gx1 + gx2) / 2} y2={DECK_Y - 6}
                stroke="#475569" strokeWidth={1} />
              <text x={(gx1 + gx2) / 2} y={DECK_Y - 16}
                textAnchor="middle" fill="#475569" fontSize={9} fontFamily="monospace">
                {s.spanLength}m
              </text>
            </g>
          );
        })}

        {/* ─── Deck slab ─── */}
        <rect
          x={DECK_X1} y={BEAM_Y}
          width={DECK_W} height={SLAB_H}
          fill={deckFill} stroke={condCol} strokeWidth={1.5}
        />

        {/* ─── Parapet walls ─── */}
        {/* Left parapet */}
        <rect x={DECK_X1} y={DECK_Y} width={10} height={PARAPET_H} fill={condDark} rx={1} />
        {/* Right parapet */}
        <rect x={DECK_X2 - 10} y={DECK_Y} width={10} height={PARAPET_H} fill={condDark} rx={1} />
        {/* Road surface */}
        <rect x={DECK_X1 + 10} y={DECK_Y + 2} width={DECK_W - 20} height={PARAPET_H - 2} fill="#374151" rx={1} />
        {/* Centre line */}
        <line x1={DECK_X1 + 10} y1={DECK_Y + PARAPET_H / 2} x2={DECK_X2 - 10} y2={DECK_Y + PARAPET_H / 2}
          stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="12 8" opacity={0.5} />

        {/* ─── Total length dimension line ─── */}
        <line x1={DECK_X1} y1={H - 28} x2={DECK_X2} y2={H - 28} stroke="#334155" strokeWidth={1} markerEnd="url(#arrow)" />
        <line x1={DECK_X1} y1={H - 34} x2={DECK_X1} y2={H - 22} stroke="#334155" strokeWidth={1} />
        <line x1={DECK_X2} y1={H - 34} x2={DECK_X2} y2={H - 22} stroke="#334155" strokeWidth={1} />
        <text x={W / 2} y={H - 14} textAnchor="middle" fill="#475569" fontSize={10} fontFamily="Inter, sans-serif">
          Total Bridge Length ≈ {totalLen} m
        </text>

        {/* ─── Info annotations ─── */}
        {/* Material badge */}
        <rect x={8} y={8} width={160} height={16} rx={4} fill="#1e293b" opacity={0.9} />
        <text x={14} y={20} fill="#94a3b8" fontSize={10} fontFamily="Inter, sans-serif">
          {s.material}
        </text>
        {/* Year built */}
        <rect x={8} y={28} width={100} height={14} rx={3} fill="#1e293b" opacity={0.8} />
        <text x={14} y={39} fill="#64748b" fontSize={9} fontFamily="monospace">
          Built {s.yearBuilt} ({age} yrs)
        </text>
        {/* Crossing type */}
        <rect x={8} y={46} width={120} height={14} rx={3} fill="#1e293b" opacity={0.8} />
        <text x={14} y={57} fill="#64748b" fontSize={9} fontFamily="monospace">
          Crosses: {s.river || s.crossingType || 'N/A'}
        </text>

        {/* Width label */}
        <text x={DECK_X1 + 14} y={DECK_Y + 11} fill="#cbd5e1" fontSize={9} fontFamily="monospace">
          W={s.width}m / {s.noOfLanes}L
        </text>

        {/* Structure ID */}
        <text x={W - 8} y={H - 14} textAnchor="end" fill="#334155" fontSize={10} fontFamily="monospace">
          {s.id}
        </text>

        {/* ─── Condition indicator ─── */}
        <rect x={W - 120} y={8} width={112} height={32} rx={6} fill={condCol + '22'} stroke={condCol + '55'} strokeWidth={1} />
        <text x={W - 64} y={22} textAnchor="middle" fill={condCol} fontSize={11} fontWeight="bold" fontFamily="Inter, sans-serif">
          Condition {s.conditionRating}/5
        </text>
        <text x={W - 64} y={34} textAnchor="middle" fill={condCol} fontSize={9} fontFamily="Inter, sans-serif">
          {conditionLabel(s.conditionRating)}
        </text>

        {/* ─── Defect hotspots ─── */}
        {defectHotspots.map((hot, i) => (
          <g key={i}
            onMouseEnter={() => setHoveredDefect(hot.d)}
            onMouseLeave={() => setHoveredDefect(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Outer pulse ring */}
            <circle cx={hot.x} cy={hot.y} r={12} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.4}>
              <animate attributeName="r" values="10;16;10" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.2s" repeatCount="indefinite" />
            </circle>
            {/* Core dot */}
            <circle cx={hot.x} cy={hot.y} r={5} fill="#ef4444" opacity={0.9} filter="url(#defectGlow)">
              <animate attributeName="opacity" values="0.9;0.6;0.9" dur="1.8s" repeatCount="indefinite" />
            </circle>
            {/* Index label */}
            <text x={hot.x} y={hot.y + 4} textAnchor="middle" fill="white" fontSize={7} fontWeight="bold">
              {i + 1}
            </text>
            {/* Tooltip (shown on hover) */}
            {hoveredDefect === hot.d && (
              <g>
                <rect
                  x={clamp(hot.x - 80, 4, W - 170)} y={hot.y - 34}
                  width={160} height={22} rx={5}
                  fill="#0f172a" stroke="#ef4444" strokeWidth={1} opacity={0.95}
                />
                <text
                  x={clamp(hot.x - 80, 4, W - 170) + 8} y={hot.y - 18}
                  fill="#ef4444" fontSize={9} fontFamily="Inter, sans-serif"
                >
                  ⚠ {hot.d}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* ─── Defect legend (right column) ─── */}
        {defectHotspots.length > 0 && (
          <g>
            {defectHotspots.slice(0, 8).map((hot, i) => (
              <g key={i}>
                <circle cx={W - 145} cy={H - 32 - (defectHotspots.length - 1 - i) * 13} r={4} fill="#ef4444" opacity={0.8} />
                <text x={W - 138} y={H - 28 - (defectHotspots.length - 1 - i) * 13}
                  fill="#94a3b8" fontSize={9} fontFamily="Inter, sans-serif">
                  {i + 1}. {hot.d.length > 22 ? hot.d.slice(0, 22) + '…' : hot.d}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* ─── No-defects badge ─── */}
        {defectHotspots.length === 0 && (
          <>
            <rect x={W / 2 - 70} y={BED_Y + 30} width={140} height={20} rx={6} fill="#14532d" opacity={0.7} />
            <text x={W / 2} y={BED_Y + 44} textAnchor="middle" fill="#4ade80" fontSize={10} fontFamily="Inter">
              ✓ No defects recorded
            </text>
          </>
        )}
      </svg>

      {/* Defect chips below SVG */}
      {defectHotspots.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 bg-slate-800 border-t border-slate-700">
          {defectHotspots.map((hot, i) => (
            <span
              key={i}
              onMouseEnter={() => setHoveredDefect(hot.d)}
              onMouseLeave={() => setHoveredDefect(null)}
              className={`text-[9px] px-2 py-0.5 rounded-full cursor-default transition-all border
                ${hoveredDefect === hot.d
                  ? 'bg-red-500/40 text-red-300 border-red-500/60'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
            >
              {i + 1}. {hot.d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function conditionRating5to1Fill(r: number): string {
  const map: Record<number, string> = {
    5: '#475569',  // slate (new, clean concrete)
    4: '#4b5563',  // grey
    3: '#92400e',  // brown-worn
    2: '#7f1d1d',  // dark red
    1: '#450a0a',  // very dark red
  };
  return map[r] ?? '#475569';
}
