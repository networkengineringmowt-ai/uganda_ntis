import { X, MapPin, Calendar, Wrench, AlertTriangle, Camera } from 'lucide-react';
import type { Structure } from '../../types';
import { conditionLabel, conditionColor, conditionBadge, formatDate, formatUGX } from '../../utils/helpers';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

interface Props {
  structure: Structure;
  onClose: () => void;
}

// S:\PHOTOS\B001\ style paths — derive from bridge ID
function photoUrl(id: string, idx: number): string {
  // Bridge IDs like BRG-B001 → S:\PHOTOS\B001\
  const match = id.match(/B(\d+)/);
  if (!match) return '';
  const num   = match[1];
  const padded = num.padStart(3, '0');
  return `file:///S:/PHOTOS/B${padded}/B${padded}_08_0${idx + 1}.JPG`;
}

export default function StructureDetailModal({ structure: s, onClose }: Props) {
  const photos = s.type === 'bridge'
    ? [0, 1, 2, 3].map(i => photoUrl(s.id, i)).filter(u => u)
    : [];

  const histData = s.conditionHistory.map(h => ({ year: String(h.year), rating: h.rating }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="badge badge-blue text-xs">{s.id}</span>
              <span className={`badge ${conditionBadge(s.conditionRating)}`}>
                {s.conditionRating} – {conditionLabel(s.conditionRating)}
              </span>
              <span className="badge badge-slate capitalize">{s.type}</span>
            </div>
            <h2 className="text-xl font-bold text-white">{s.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <MapPin size={12} />
              {s.road} · KM {s.chainage.toFixed(1)} · {s.region} Region
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-5">
              {/* Physical */}
              <Section title="Physical Characteristics">
                <Grid2>
                  <Field label="Structure Type"  value={s.crossingType} />
                  <Field label="Material"         value={s.material} />
                  <Field label="Span Length"      value={`${s.spanLength} m`} />
                  <Field label="No. of Spans"     value={s.noOfSpans} />
                  <Field label="Width"            value={`${s.width} m`} />
                  <Field label="No. of Lanes"     value={s.noOfLanes} />
                  <Field label="No. of Piers"     value={s.noOfPiers} />
                  <Field label="Surface Type"     value={s.surfaceType} />
                  <Field label="Year Built"       value={s.yearBuilt} />
                  <Field label="Age"              value={`${2024 - s.yearBuilt} years`} />
                </Grid2>
              </Section>

              {/* Location */}
              <Section title="Location & Administration">
                <Grid2>
                  <Field label="Road Number"     value={s.roadNumber || '—'} />
                  <Field label="Road Name"        value={s.road} />
                  <Field label="Chainage"         value={`${s.chainage.toFixed(2)} km`} />
                  <Field label="Region"           value={s.region} />
                  <Field label="Maintenance Area" value={s.maintenanceArea} />
                  <Field label="River"            value={s.river || '—'} />
                  <Field label="Latitude"         value={s.lat.toFixed(6)} mono />
                  <Field label="Longitude"        value={s.lng.toFixed(6)} mono />
                </Grid2>
              </Section>

              {/* Cost */}
              <Section title="Financial">
                <Grid2>
                  <Field label="Est. Replacement" value={formatUGX(s.estimatedReplacementCost)} />
                  <Field label="Traffic Level"    value={s.traffic} />
                  <Field label="Strategic Imp."   value={`${s.strategicImportance} / 5`} />
                  <Field label="Priority Score"   value={`${s.priorityScore} / 100`} />
                  <Field label="Priority Rank"    value={`#${s.priorityRank}`} />
                </Grid2>
              </Section>
            </div>

            {/* Column 2 */}
            <div className="space-y-5">
              {/* Condition trend */}
              <Section title="Condition History (2018–2024)">
                <div className="mt-1">
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={histData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [conditionLabel(v), 'Rating']}
                      />
                      <Line
                        type="monotone"
                        dataKey="rating"
                        stroke={conditionColor(s.conditionRating)}
                        strokeWidth={2}
                        dot={{ r: 4, fill: conditionColor(s.conditionRating), strokeWidth: 0 }}
                        animationDuration={600}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              {/* Inspection */}
              <Section title="Inspection Status">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar size={13} className="text-slate-500" />
                    <span className="text-slate-400">Last Inspection:</span>
                    <span className="text-white font-medium">{formatDate(s.lastInspection)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar size={13} className="text-slate-500" />
                    <span className="text-slate-400">Next Inspection:</span>
                    <span className={`font-medium ${s.inspectionDue ? 'text-red-400' : 'text-green-400'}`}>
                      {formatDate(s.nextInspection)} {s.inspectionDue ? '⚠ OVERDUE' : '✓'}
                    </span>
                  </div>
                </div>
              </Section>

              {/* Defects */}
              {s.defects.length > 0 && (
                <Section title="Recorded Defects">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {s.defects.map(d => (
                      <span key={d} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertTriangle size={9} /> {d}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Photos — real S:\PHOTOS\ links */}
              {photos.length > 0 && (
                <Section title="Site Photos">
                  <div className="flex items-center gap-1 mt-1">
                    <Camera size={13} className="text-slate-500" />
                    <span className="text-xs text-slate-400">Photos available in</span>
                    <code className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      S:\PHOTOS\{s.id.replace('BRG-', '')}\
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {photos.slice(0, 4).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-video rounded-lg bg-slate-700 border border-slate-600 overflow-hidden hover:border-blue-500 transition-colors"
                      >
                        <img
                          src={url}
                          alt={`${s.name} photo ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                          <Camera size={20} />
                        </div>
                      </a>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex-shrink-0">
          <span className="text-xs text-slate-500">
            <Wrench size={11} className="inline mr-1" />
            Maintenance: {s.maintenanceArea} Area
          </span>
          <button onClick={onClose} className="bms-btn-secondary text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">{title}</div>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function Field({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-xs text-slate-200 font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
