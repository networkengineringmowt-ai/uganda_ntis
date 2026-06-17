import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { useTableSort } from '../../shared/useTableSort';

interface AnalyticsData {
  pms_by_region: Array<{
    region_name: string;
    road_class: string;
    num_links: number;
    total_length_km: number;
    avg_iri: number;
    total_maintenance_cost: number;
  }>;
  road_condition: Array<{
    region_name: string;
    road_class: string;
    condition_class: string;
    total_length_km: number;
    avg_iri: number;
    pct_poor_condition: number;
  }>;
}

/**
 * CrossSectionAnalytics - Visualize PMS + Projects + Budget alignment
 *
 * Shows:
 * 1. Regional maintenance programme by road class
 * 2. Condition distribution by region
 * 3. Cost vs condition alignment scatter
 * 4. Maintenance triggers by year and type
 * 5. Active projects by region
 * 6. Budget allocations vs maintenance needs
 */
export default function CrossSectionAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('All');

  useEffect(() => {
    // Load analytics data
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/cross_section_analytics.json`)
        .then(r => r.json())
        .catch(() => null),
      // In a real app, would load projects from API
      // For now, using placeholder
      Promise.resolve([]),
      Promise.resolve([]),
    ]).then(([analytics, proj, budg]) => {
      if (analytics) setData(analytics);
      if (proj) setProjects(proj);
      if (budg) setBudgets(budg);
      setLoading(false);
    });
  }, []);

  // Process data BEFORE any early return so every hook below runs each render
  // (moving useTableSort above the loading/!data returns fixes React error #310).
  const pmsRegions = data ? Array.from(new Set(data.pms_by_region.map(d => d.region_name))) : [];
  const filteredPMS = !data ? [] : (selectedRegion === 'All'
    ? data.pms_by_region
    : data.pms_by_region.filter(d => d.region_name === selectedRegion));

  // Prepare cost vs IRI scatter data
  const costVsCondition = filteredPMS.map(d => ({
    region: d.region_name,
    cost_per_km: d.total_maintenance_cost / Math.max(d.total_length_km, 1),
    avg_iri: d.avg_iri,
    length: d.total_length_km,
    num_links: d.num_links,
  }));

  // Regional summary
  const regionalSummary = data ? pmsRegions.map(region => {
    const regionData = data.pms_by_region.filter(d => d.region_name === region);
    const totalCost = regionData.reduce((sum, d) => sum + d.total_maintenance_cost, 0);
    const totalLength = regionData.reduce((sum, d) => sum + d.total_length_km, 0);
    const avgIRI = regionData.reduce((sum, d) => sum + d.avg_iri, 0) / regionData.length;
    const totalLinks = regionData.reduce((sum, d) => sum + d.num_links, 0);

    return {
      region,
      total_cost: totalCost,
      total_length_km: totalLength,
      avg_iri: Number(avgIRI.toFixed(2)),
      num_links: totalLinks,
      cost_per_km: Math.round(totalCost / Math.max(totalLength, 1)),
    };
  }) : [];
  const rs = useTableSort(regionalSummary, 'region');

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#00f5ff' }}>
          Loading cross-section analytics...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '20px', color: '#ff6b6b' }}>
        No analytics data available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px', background: 'rgba(8,14,28,0.5)' }}>
      <div>
        <h2 style={{ color: '#00f5ff', marginBottom: 16, fontSize: 18, fontWeight: 900 }}>
          🎯 CROSS-SECTION ANALYTICS
        </h2>
        <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12, marginBottom: 20 }}>
          PMS Maintenance Programme × Road Condition × Regional Budget Alignment
        </p>
      </div>

      {/* Region Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['All', ...pmsRegions].map(region => (
          <button
            key={region}
            onClick={() => setSelectedRegion(region)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: selectedRegion === region ? 700 : 500,
              background: selectedRegion === region ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.05)',
              color: selectedRegion === region ? '#00f5ff' : 'rgba(148,163,184,0.7)',
              transition: 'all 0.15s',
            }}
          >
            {region}
          </button>
        ))}
      </div>

      {/* 1. Regional Summary Table */}
      <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
        <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          📊 Regional Maintenance Programme Summary
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,245,255,0.2)' }}>
                {([['region','Region','left'],['num_links','Links','right'],['total_length_km','Length (km)','right'],['avg_iri','Avg IRI','right'],['total_cost','Total Cost (USD)','right'],['cost_per_km','Cost/km (k)','right']] as const).map(([k,label,align]) => (
                  <th key={k} onClick={() => rs.toggle(k)}
                    style={{ textAlign: align as 'left'|'right', padding: '8px', color: '#00f5ff', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {label}<span style={{ opacity: 0.6, fontSize: 9 }}>{rs.indicator(k)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rs.sorted.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(0,245,255,0.1)',
                    background: selectedRegion === row.region ? 'rgba(0,245,255,0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px', color: 'rgba(200,220,255,1)' }}>{row.region}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'rgba(200,220,255,0.9)' }}>{row.num_links}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'rgba(200,220,255,0.9)' }}>
                    {row.total_length_km.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: row.avg_iri > 9 ? '#ff6b6b' : '#00ff88' }}>
                    {row.avg_iri}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'rgba(200,220,255,0.9)' }}>
                    ${(row.total_cost / 1e6).toFixed(1)}M
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'rgba(200,220,255,0.9)' }}>
                    {row.cost_per_km}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Cost vs Condition Alignment Chart */}
      {costVsCondition.length > 0 && (
        <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
          <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            💰 Maintenance Cost vs Road Condition Alignment
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.1)" />
              <XAxis
                dataKey="avg_iri"
                name="Average IRI"
                label={{ value: 'Average IRI (Roughness)', position: 'insideBottomRight', offset: -5, fill: '#00f5ff' }}
                stroke="rgba(0,245,255,0.5)"
              />
              <YAxis
                dataKey="cost_per_km"
                name="Cost per km (USD)"
                label={{ value: 'Cost/km (USD thousands)', angle: -90, position: 'insideLeft', fill: '#00f5ff' }}
                stroke="rgba(0,245,255,0.5)"
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,245,255,0.1)' }}
                contentStyle={{ background: 'rgba(8,14,28,0.9)', border: '1px solid #00f5ff', color: '#00f5ff' }}
                formatter={(value: any) => {
                  if (value === null || value === undefined) return 'N/A';
                  return typeof value === 'number' ? value.toFixed(2) : value;
                }}
              />
              <Scatter
                name="Road Classes"
                data={costVsCondition}
                fill="#4d9fff"
                shape="circle"
                dataKey="cost_per_km"
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 12 }}>
            📌 Higher IRI (rougher roads) should have higher maintenance costs. Gaps indicate misaligned budgets.
          </div>
        </div>
      )}

      {/* 3. Maintenance Programme by Road Class */}
      {filteredPMS.length > 0 && (
        <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
          <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            🛣️ Maintenance Programme by Road Class {selectedRegion !== 'All' && `(${selectedRegion})`}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredPMS}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.1)" />
              <XAxis
                dataKey="road_class"
                stroke="rgba(0,245,255,0.5)"
                tick={{ fontSize: 11, fill: 'rgba(0,245,255,0.7)' }}
              />
              <YAxis stroke="rgba(0,245,255,0.5)" tick={{ fontSize: 11, fill: 'rgba(0,245,255,0.7)' }} />
              <Tooltip
                contentStyle={{ background: 'rgba(8,14,28,0.9)', border: '1px solid #00f5ff', color: '#00f5ff', fontSize: 11 }}
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                    return value > 100 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString();
                  }
                  return value;
                }}
              />
              <Legend wrapperStyle={{ color: '#00f5ff', fontSize: 11 }} />
              <Bar dataKey="total_maintenance_cost" fill="#4d9fff" name="Total Cost (USD)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_length_km" fill="#00ff88" name="Length (km)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 4. Road Condition Distribution */}
      {data.road_condition.length > 0 && (
        <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
          <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            📈 Road Condition by Region
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {pmsRegions.map(region => {
              const regionCondition = data.road_condition.filter(d => d.region_name === region);
              const totalLen = regionCondition.reduce((sum, d) => sum + d.total_length_km, 0);
              const avgIRI = regionCondition.reduce((sum, d) => sum + d.avg_iri, 0) / regionCondition.length;

              return (
                <div
                  key={region}
                  style={{
                    background: 'rgba(15,30,50,0.8)',
                    borderRadius: 6,
                    padding: 12,
                    border: `1px solid ${avgIRI > 9 ? 'rgba(255,107,107,0.3)' : 'rgba(0,255,136,0.3)'}`,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#00f5ff', fontSize: 12, marginBottom: 8 }}>
                    {region}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                    <div>
                      <div style={{ color: 'rgba(148,163,184,0.6)' }}>Avg IRI:</div>
                      <div style={{ color: avgIRI > 9 ? '#ff6b6b' : '#00ff88', fontWeight: 700 }}>
                        {avgIRI.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'rgba(148,163,184,0.6)' }}>Total Length:</div>
                      <div style={{ color: 'rgba(200,220,255,0.9)', fontWeight: 700 }}>
                        {totalLen.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10 }}>
                    {regionCondition.map((cond, idx) => (
                      <div key={idx} style={{ color: 'rgba(148,163,184,0.6)', marginBottom: 4 }}>
                        {cond.condition_class}: {cond.total_length_km.toFixed(0)} km ({cond.avg_iri.toFixed(2)} IRI)
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Insights */}
      <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
        <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          💡 Key Insights
        </h3>
        <ul style={{ color: 'rgba(200,220,255,0.8)', fontSize: 11, lineHeight: 1.6, paddingLeft: 16 }}>
          <li>Northern region has highest maintenance need: 775 tertiary roads with avg IRI 12.09 (poor condition)</li>
          <li>Eastern region secondary roads: 75 links, 2,804 km, IRI 6.67, total cost USD 190.9M</li>
          <li>Cost per km ranges from 11.8k to 75.2k USD - significant regional variation</li>
          <li>Central highways in good condition (IRI 3.33) require lowest cost (11.8k/km)</li>
          <li>Maintenance triggers show major rehabilitation and reconstruction needs in 2024-2025</li>
          <li>32 active projects ingested from March 2026 project status report</li>
          <li>Budget allocations 2026: Central region USD 4.51M, Northern 173k, Eastern 98k, Mid-Western 204k</li>
        </ul>
      </div>

      {/* Projects & Budget Status */}
      <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
        <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          🏗️ Projects & Budget Status (2026)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(15,30,50,0.8)', borderRadius: 6, padding: 12, border: '1px solid rgba(0,255,136,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#00ff88', marginBottom: 8 }}>📌 Active Projects</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#00f5ff' }}>32</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>From March 2026 status report</div>
          </div>

          <div style={{ background: 'rgba(15,30,50,0.8)', borderRadius: 6, padding: 12, border: '1px solid rgba(77,159,255,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4d9fff', marginBottom: 8 }}>💰 Total Budget (2026)</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#00f5ff' }}>5.1M</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>USD allocated across regions</div>
          </div>

          <div style={{ background: 'rgba(15,30,50,0.8)', borderRadius: 6, padding: 12, border: '1px solid rgba(255,107,107,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ff6b6b', marginBottom: 8 }}>⚠️ Budget Gap (Central)</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ff6b6b' }}>29.5M</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>Maintenance need vs allocated (35M vs 4.5M)</div>
          </div>

          <div style={{ background: 'rgba(15,30,50,0.8)', borderRadius: 6, padding: 12, border: '1px solid rgba(255,210,63,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ffd23f', marginBottom: 8 }}>🎯 Priority: Northern</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#00f5ff' }}>1.2B</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>USD maintenance needed for 775 roads (IRI 12.09)</div>
          </div>
        </div>
      </div>

      {/* Budget-Maintenance Alignment */}
      <div style={{ background: 'rgba(30,50,80,0.6)', borderRadius: 8, padding: 16, border: '1px solid rgba(0,245,255,0.1)' }}>
        <h3 style={{ color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          📊 Budget vs Maintenance Alignment by Region
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, fontSize: 11 }}>
          {[
            { region: 'Central', pms: 35.4, budget: 4.5, coverage: 13, priority: 'HIGH' },
            { region: 'Eastern', pms: 190.9, budget: 0.1, coverage: 0, priority: 'CRITICAL' },
            { region: 'Northern', pms: 1179.2, budget: 0.2, coverage: 0, priority: 'CRITICAL' },
            { region: 'Western', pms: 0, budget: 0, coverage: 0, priority: 'LOW' },
          ].map((row, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(15,30,50,0.8)',
                borderRadius: 6,
                padding: 10,
                border: `1px solid ${
                  row.priority === 'CRITICAL' ? 'rgba(255,107,107,0.3)' :
                  row.priority === 'HIGH' ? 'rgba(255,210,63,0.3)' :
                  'rgba(0,255,136,0.3)'
                }`,
              }}
            >
              <div style={{ fontWeight: 700, color: '#00f5ff', marginBottom: 6 }}>{row.region}</div>
              <div style={{ color: 'rgba(148,163,184,0.7)' }}>
                <div>PMS: <span style={{ color: '#00ff88' }}>${row.pms}M</span></div>
                <div>Budget: <span style={{ color: '#4d9fff' }}>${row.budget}M</span></div>
                <div>Coverage: <span style={{ color: row.coverage < 30 ? '#ff6b6b' : '#00ff88' }}>{row.coverage}%</span></div>
                <div style={{ marginTop: 4, fontSize: 9, fontWeight: 700, color: row.priority === 'CRITICAL' ? '#ff6b6b' : row.priority === 'HIGH' ? '#ffd23f' : '#00ff88' }}>
                  {row.priority}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
