import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area, ReferenceLine } from 'recharts';
import { Activity, Zap, FileText, Shield, FlaskConical, AlertOctagon, Table } from 'lucide-react';

// --- DATA MAPPER: Convert oil test records (camelCase) to chart format ---
function mapOilTestsToChartData(oilTests) {
  if (!oilTests || oilTests.length === 0) return [];

  // Sort by date ascending (oldest first for trending)
  const sorted = [...oilTests].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));

  return sorted.map(test => {
    const d = new Date(test.testDate);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
      date,
      H2: parseFloat(test.h2) || 0,
      CH4: parseFloat(test.ch4) || 0,
      C2H2: parseFloat(test.c2h2) || 0,
      C2H4: parseFloat(test.c2h4) || 0,
      C2H6: parseFloat(test.c2h6) || 0,
      CO: parseFloat(test.co) || 0,
      CO2: parseFloat(test.co2) || 0,
      O2: parseFloat(test.o2) || 0,
      N2: parseFloat(test.n2) || 0,
      TDCG: parseFloat(test.tdcg) || 0,
      BDV: parseFloat(test.breakdown) || 0,
      Moisture: parseFloat(test.waterContent) || 0,
      Acidity: parseFloat(test.acidity) || 0,
      IFT: parseFloat(test.interfacialTension) || 0,
      TanDelta: parseFloat(test.powerFactor) || 0,
      Inhibitor: test.inhibitor !== null && test.inhibitor !== undefined && test.inhibitor !== '' ? parseFloat(test.inhibitor) : null,
      Color: test.color || '',
      ColorValue: test.color ? parseFloat(String(test.color).replace(/[^\d.-]/g, '')) || 0 : 0,
      DBDS: parseFloat(test.dbds) || 0,
      CopperCorr: test.copperCorrosive && String(test.copperCorrosive).toLowerCase() !== 'no' && String(test.copperCorrosive) !== '0' ? 1 : 0,
      Passivator: parseFloat(test.passivator) || 0,
      Furan: parseFloat(test.fal2) || 0,
      Methanol: parseFloat(test.methanol) || 0,
      DPFuran: test.estimatedDpFuran ? parseFloat(test.estimatedDpFuran) : null,
      DPMethanol: test.estimatedDpMethanol ? parseFloat(test.estimatedDpMethanol) : null,
    };
  });
}

// --- HELPER: Trend arrow ---
const TrendValue = ({ current, previous, type = 'normal' }) => {
  if (previous === null || previous === undefined) return <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 10 }}>-</span>;
  if (current === 0 && previous === 0) return <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 10 }}>-</span>;

  const diff = current - previous;
  const percent = previous !== 0 ? ((diff / previous) * 100).toFixed(0) : 100;

  if (Math.abs(diff) < 0.001) return <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>(-)</span>;

  const isUp = diff > 0;
  let color = '#9ca3af';
  if (type === 'inverse') {
    color = diff < 0 ? '#ef4444' : '#16a34a';
  } else {
    color = diff > 0 ? '#ef4444' : '#16a34a';
  }

  return (
    <span style={{ fontSize: 10, fontWeight: 'bold', marginLeft: 4, color }}>
      {isUp ? '▲' : '▼'}{Math.abs(percent)}%
    </span>
  );
};

// --- DYNAMIC DGA CHART with clickable legend ---
const DynamicDGAChart = ({ data }) => {
  const [visible, setVisible] = useState({
    H2: true, CH4: true, C2H6: true, C2H4: true, C2H2: true, CO: true, TDCG: true
  });

  const handleLegendClick = (o) => {
    const { dataKey } = o;
    setVisible(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" fontSize={10} tickMargin={10} stroke="#94a3b8" />
        <YAxis fontSize={12} stroke="#94a3b8" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
        <Legend
          verticalAlign="top"
          height={36}
          onClick={handleLegendClick}
          cursor="pointer"
          formatter={(value, entry) => {
            const { dataKey } = entry;
            return <span style={{ opacity: visible[dataKey] ? 1 : 0.3, color: visible[dataKey] ? '#e2e8f0' : '#64748b' }}>{value}</span>;
          }}
        />
        <Line type="monotone" dataKey="H2" name="Hydrogen (H₂)" stroke="#10b981" strokeWidth={2} dot={false} hide={!visible.H2} />
        <Line type="monotone" dataKey="CH4" name="Methane (CH₄)" stroke="#3b82f6" strokeWidth={2} dot={false} hide={!visible.CH4} />
        <Line type="monotone" dataKey="C2H6" name="Ethane (C₂H₆)" stroke="#8b5cf6" strokeWidth={2} dot={false} hide={!visible.C2H6} />
        <Line type="monotone" dataKey="C2H4" name="Ethylene (C₂H₄)" stroke="#ef4444" strokeWidth={2} dot={false} hide={!visible.C2H4} />
        <Line type="monotone" dataKey="C2H2" name="Acetylene (C₂H₂)" stroke="#f97316" strokeWidth={2} dot={false} hide={!visible.C2H2} />
        <Line type="monotone" dataKey="CO" name="CO" stroke="#f59e0b" strokeWidth={2} dot={false} hide={!visible.CO} />
        <Line type="monotone" dataKey="TDCG" name="TDCG" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} hide={!visible.TDCG} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// --- DASHBOARD CARD ---
const DashboardCard = ({ title, children, icon: Icon }) => (
  <div className="trending-card">
    <div className="trending-card-header">
      <h3 className="trending-card-title">{title}</h3>
      {Icon && <Icon size={18} style={{ color: '#94a3b8' }} />}
    </div>
    <div className="trending-card-body">
      {children}
    </div>
  </div>
);

// --- CORROSION TOOLTIP ---
const CorrosionTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dbds = payload.find(p => p.name.includes('DBDS'));
    const passivator = payload.find(p => p.name.includes('Passivator'));
    const corrosion = payload.find(p => p.name.includes('Corrosion'));
    return (
      <div style={{ background: '#1e293b', padding: 12, border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#ef4444' }}>DBDS: {dbds ? dbds.value : 'N/A'} ppm</p>
        <p style={{ color: '#3b82f6' }}>Passivator: {passivator ? passivator.value : 0} ppm</p>
        <div style={{
          marginTop: 8, padding: '4px 8px', borderRadius: 4, textAlign: 'center', fontSize: 11, fontWeight: 700,
          background: corrosion && corrosion.value > 0 ? '#fef2f2' : '#f0fdf4',
          color: corrosion && corrosion.value > 0 ? '#b91c1c' : '#15803d'
        }}>
          {corrosion && corrosion.value > 0 ? '⚠️ CORROSIVE' : 'NON-CORROSIVE'}
        </div>
      </div>
    );
  }
  return null;
};

// --- FULL HISTORY TABLE ---
const FullHistoryTable = ({ data }) => {
  const sortedData = [...data].reverse();

  return (
    <div className="trending-table-container">
      <div className="trending-table-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Table size={14} style={{ color: '#94a3b8' }} />
          <h3 style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13, margin: 0 }}>Full Sample History</h3>
        </div>
        <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>* Arrows indicate % change from previous sample</span>
      </div>

      <div className="trending-table-scroll">
        <table className="trending-table">
          <thead>
            <tr>
              <th className="trending-th-sticky">Date</th>
              <th className="trending-th-dga">H₂</th>
              <th className="trending-th-dga">CH₄</th>
              <th className="trending-th-dga">C₂H₆</th>
              <th className="trending-th-dga">C₂H₄</th>
              <th className="trending-th-dga">C₂H₂</th>
              <th className="trending-th-dga">CO</th>
              <th className="trending-th-tdcg">TDCG</th>
              <th className="trending-th">Moisture</th>
              <th className="trending-th">BDV</th>
              <th className="trending-th">Acidity</th>
              <th className="trending-th">IFT</th>
              <th className="trending-th">Tan δ</th>
              <th className="trending-th" style={{ borderRight: '1px solid #334155' }}>Color</th>
              <th className="trending-th-chem">Inhibitor</th>
              <th className="trending-th-chem">DBDS</th>
              <th className="trending-th-chem">Passivator</th>
              <th className="trending-th-chem" style={{ borderRight: '1px solid #334155' }}>Corr. S</th>
              <th className="trending-th-aging">Furan</th>
              <th className="trending-th-aging">Methanol</th>
              <th className="trending-th-aging">DP (Furan)</th>
              <th className="trending-th-aging">DP (Methanol)</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              const prev = sortedData[index + 1];
              return (
                <tr key={index} className="trending-tr">
                  <td className="trending-td-sticky">{row.date}</td>
                  <td className="trending-td">{row.H2} <TrendValue current={row.H2} previous={prev?.H2} /></td>
                  <td className="trending-td">{row.CH4} <TrendValue current={row.CH4} previous={prev?.CH4} /></td>
                  <td className="trending-td">{row.C2H6} <TrendValue current={row.C2H6} previous={prev?.C2H6} /></td>
                  <td className="trending-td">{row.C2H4} <TrendValue current={row.C2H4} previous={prev?.C2H4} /></td>
                  <td className="trending-td">{row.C2H2} <TrendValue current={row.C2H2} previous={prev?.C2H2} /></td>
                  <td className="trending-td">{row.CO} <TrendValue current={row.CO} previous={prev?.CO} /></td>
                  <td className="trending-td" style={{ fontWeight: 700, color: '#93c5fd', background: 'rgba(59,130,246,0.08)', borderRight: '1px solid #334155' }}>
                    {row.TDCG} <TrendValue current={row.TDCG} previous={prev?.TDCG} />
                  </td>
                  <td className="trending-td">{row.Moisture} <TrendValue current={row.Moisture} previous={prev?.Moisture} /></td>
                  <td className="trending-td">{row.BDV} <TrendValue current={row.BDV} previous={prev?.BDV} type="inverse" /></td>
                  <td className="trending-td">{row.Acidity} <TrendValue current={row.Acidity} previous={prev?.Acidity} /></td>
                  <td className="trending-td">{row.IFT} <TrendValue current={row.IFT} previous={prev?.IFT} type="inverse" /></td>
                  <td className="trending-td">{row.TanDelta} <TrendValue current={row.TanDelta} previous={prev?.TanDelta} /></td>
                  <td className="trending-td" style={{ borderRight: '1px solid #334155' }}>{row.Color || '-'}</td>
                  <td className="trending-td">
                    <span style={{ color: row.Inhibitor !== null && row.Inhibitor < 0.3 ? '#ef4444' : 'inherit', fontWeight: row.Inhibitor !== null && row.Inhibitor < 0.3 ? 700 : 400 }}>
                      {row.Inhibitor !== null ? row.Inhibitor : '-'}
                    </span>
                    <TrendValue current={row.Inhibitor} previous={prev?.Inhibitor} type="inverse" />
                  </td>
                  <td className="trending-td">{row.DBDS || '-'} <TrendValue current={row.DBDS} previous={prev?.DBDS} /></td>
                  <td className="trending-td">{row.Passivator || '-'} <TrendValue current={row.Passivator} previous={prev?.Passivator} /></td>
                  <td className="trending-td" style={{ borderRight: '1px solid #334155' }}>
                    {row.CopperCorr === 1
                      ? <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>FAIL</span>
                      : <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 10 }}>PASS</span>}
                  </td>
                  <td className="trending-td">{row.Furan || '-'} <TrendValue current={row.Furan} previous={prev?.Furan} /></td>
                  <td className="trending-td">{row.Methanol || '-'} <TrendValue current={row.Methanol} previous={prev?.Methanol} /></td>
                  <td className="trending-td">{row.DPFuran !== null ? row.DPFuran : '-'} <TrendValue current={row.DPFuran} previous={prev?.DPFuran} type="inverse" /></td>
                  <td className="trending-td">{row.DPMethanol !== null ? row.DPMethanol : '-'} <TrendValue current={row.DPMethanol} previous={prev?.DPMethanol} type="inverse" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function DataTrending({ oilTests, transformer }) {
  const chartData = useMemo(() => mapOilTestsToChartData(oilTests), [oilTests]);

  if (!oilTests || oilTests.length === 0) {
    return (
      <div className="data-trending-tab">
        <div className="empty-state">
          <svg className="empty-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p>No Oil Test Data Available</p>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Add oil test records to see trending charts</span>
        </div>
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' };

  return (
    <div className="data-trending-tab">
      {/* Asset Info Banner */}
      {transformer && (
        <div className="trending-asset-info">
          <div className="trending-asset-left">
            <Zap size={20} style={{ color: '#0d9488' }} />
            <div>
              <h2 className="trending-asset-name">{transformer.txName || 'Transformer'} ({transformer.mnemonic || '-'})</h2>
              <p className="trending-asset-detail">Serial: {transformer.serialNumber || '-'} | {transformer.loadMVA || '-'} MVA | {transformer.voltage || '-'}</p>
            </div>
          </div>
          <div className="trending-asset-right">
            <span className="trending-asset-tag">Maker: {transformer.maker || '-'}</span>
            <span className="trending-asset-tag">Year: {transformer.yearBuilt || '-'}</span>
            <span className="trending-asset-tag">{chartData.length} Samples</span>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="trending-grid">
        {/* DGA Chart */}
        <DashboardCard title="DGA: Fault Gases & TDCG (Click Legend to Toggle)" icon={Activity}>
          <DynamicDGAChart data={chartData} />
        </DashboardCard>

        {/* Inhibitor Depletion */}
        <DashboardCard title="Inhibitor (DBPC) Depletion" icon={Shield}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} connectNulls={true}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis label={{ value: '% Content', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} domain={[0, 0.6]} stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
              <Line type="stepAfter" dataKey="Inhibitor" name="DBPC Content (%)" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
              <ReferenceLine y={0.30} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: 'Re-inhibit Warning', fill: '#f59e0b', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Corrosive Sulfur & Passivation */}
        <DashboardCard title="Corrosive Sulfur & Passivation" icon={AlertOctagon}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis yAxisId="left" label={{ value: 'Concentration (ppm)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" type="number" domain={[0, 1]} tickFormatter={(val) => val === 1 ? 'Fail' : 'Pass'} stroke="#94a3b8" />
              <Tooltip content={<CorrosionTooltip />} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
              <Bar yAxisId="left" dataKey="DBDS" name="DBDS (ppm)" fill="#ef4444" barSize={20} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="Passivator" name="Passivator (ppm)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="step" dataKey="CopperCorr" name="Copper Corrosion" stroke="transparent" dot={(props) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return null;
                return payload.CopperCorr === 1
                  ? <path d={`M${cx},${cy - 6} L${cx + 6},${cy + 6} L${cx - 6},${cy + 6} Z`} fill="#ef4444" stroke="none" />
                  : <circle cx={cx} cy={cy} r={4} fill="#10b981" />;
              }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Paper Aging: Furan, Methanol & DP */}
        <DashboardCard title="Paper Aging: Furan, Methanol & DP" icon={FileText}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} connectNulls>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis yAxisId="left" label={{ value: 'By-products (ppb)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[200, 1000]} label={{ value: 'Est. DP Value', angle: 90, position: 'insideRight', fill: '#94a3b8' }} stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
              <Line yAxisId="left" type="monotone" dataKey="Furan" name="2-FAL (ppb)" stroke="#8b5cf6" strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="Methanol" name="Methanol (ppb)" stroke="#ec4899" strokeDasharray="3 3" />
              <Line yAxisId="right" type="monotone" dataKey="DPFuran" name="Est. DP (Furan)" stroke="#64748b" strokeWidth={2} strokeDasharray="10 5" />
              <Line yAxisId="right" type="monotone" dataKey="DPMethanol" name="Est. DP (Methanol)" stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Oil Aging: IFT & Tan Delta */}
        <DashboardCard title="Oil Aging: IFT & Tan Delta" icon={Zap}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis yAxisId="left" label={{ value: 'IFT (mN/m)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} domain={[0, 60]} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Tan Delta', angle: 90, position: 'insideRight', fill: '#94a3b8' }} stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
              <Area yAxisId="left" type="monotone" dataKey="IFT" fill="#8b5cf6" fillOpacity={0.1} stroke="#8b5cf6" />
              <Line yAxisId="right" type="monotone" dataKey="TanDelta" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Physical: Color & Acidity */}
        <DashboardCard title="Physical: Color & Acidity" icon={FlaskConical}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#6366f1" label={{ value: 'ASTM Color', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} domain={[0, 4]} ticks={[0.5, 1.0, 1.5, 2.0, 2.5]} />
              <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" label={{ value: 'Acidity', angle: 90, position: 'insideRight', fill: '#94a3b8' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
              <Bar yAxisId="left" dataKey="ColorValue" name="ASTM Color" fill="#fbbf24" barSize={30} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="Acidity" stroke="#f43f5e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>
      </div>

      {/* Full History Table */}
      <FullHistoryTable data={chartData} />
    </div>
  );
}
