import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area, ReferenceLine } from 'recharts';
import { Activity, Zap, FileText, Shield, FlaskConical, AlertOctagon, Table } from 'lucide-react';
import { buildAssessmentLookup, resolveAssessmentText } from './assessmentText';
import { getOilTestDisplayDigits } from './OilTestSections';

// --- DATA MAPPER: Convert records to chart format ---
function mapRecordsToChartData(records, assessmentLookup) {
  if (!records || records.length === 0) return [];

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));

  return sorted.map((test, sampleIndex) => {
    const sampleDate = test.date || test.testDate || test.samplingDate || '';
    const d = new Date(sampleDate);
    const date = Number.isNaN(d.getTime())
      ? (sampleDate || '-')
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const H2 = parseFloat(test.H2) || 0;
    const CH4 = parseFloat(test.CH4) || 0;
    const C2H2 = parseFloat(test.C2H2) || 0;
    const C2H4 = parseFloat(test.C2H4) || 0;
    const C2H6 = parseFloat(test.C2H6) || 0;
    const CO = parseFloat(test.CO) || 0;

    return {
      id: test.id || '',
      sampleIndex,
      transformerId: test.transformerId || '',
      sampleDate,
      date,
      notes: String(test.notes || ''),
      assessmentText: resolveAssessmentText({
        notes: test.notes,
        resultId: test.id,
        resultDate: sampleDate,
        assessmentLookup,
      }),
      H2,
      CH4,
      C2H2,
      C2H4,
      C2H6,
      CO,
      CO2: parseFloat(test.CO2) || 0,
      O2: parseFloat(test.O2) || 0,
      N2: parseFloat(test.N2) || 0,
      TDCG: parseFloat(test.TDCG) || (H2 + CH4 + C2H2 + C2H4 + C2H6 + CO),
      BDV: parseFloat(test.bdv) || 0,
      Moisture: parseFloat(test.moisture) || 0,
      Acidity: parseFloat(test.acidity) || 0,
      IFT: parseFloat(test.ift) || 0,
      TanDelta: parseFloat(test.powerFactor) || 0,
      Inhibitor: test.inhibitor !== null && test.inhibitor !== undefined && test.inhibitor !== '' ? parseFloat(test.inhibitor) : null,
      Color: test.color || '',
      ColorValue: test.color ? parseFloat(String(test.color).replace(/[^\d.-]/g, '')) || 0 : 0,
      DBDS: parseFloat(test.dbds) || 0,
      CopperCorr: test.copperCorrosive && String(test.copperCorrosive).toLowerCase() !== 'no' && String(test.copperCorrosive) !== '0' ? 1 : 0,
      Passivator: parseFloat(test.passivator) || 0,
      Furan: parseFloat(test.fal2) || 0,
      Methanol: parseFloat(test.methanol) || 0,
      DPFuran: test.dpFromFuran ? parseFloat(test.dpFromFuran) : null,
      DPMethanol: test.dpFromMethanol ? parseFloat(test.dpFromMethanol) : null,
      FlashPoint: parseFloat(test.flashPoint) || null,
      FlashPointOC: parseFloat(test.flashPointOpenCup) || null,
      FirePointOC: parseFloat(test.firePointOpenCup) || null,
      Density: parseFloat(test.density) || null,
      Viscosity: parseFloat(test.viscosity40) || null,
      PCB: parseFloat(test.pcb) || null,
      Resistivity: parseFloat(test.resistivity) || null,
      SpecificGravity: parseFloat(test.specificGravity) || null,
    };
  });
}

const OIL_DISPLAY_KEY_MAP = {
  Acidity: 'acidity',
  TanDelta: 'powerFactor',
  Inhibitor: 'inhibitor',
  Density: 'density',
  Viscosity: 'viscosity40',
  Methanol: 'methanol',
  Resistivity: 'resistivity',
  SpecificGravity: 'specificGravity',
};

function formatChartMetricValue(seriesKey, value) {
  if (value === null || value === undefined || value === '') return '-';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;

  const oilKey = OIL_DISPLAY_KEY_MAP[seriesKey];
  const digits = oilKey ? getOilTestDisplayDigits(oilKey) : undefined;
  return digits !== undefined ? numericValue.toFixed(digits) : numericValue;
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
const DynamicDGAChart = ({ data, onSampleSelect }) => {
  const [visible, setVisible] = useState({
    H2: true, CH4: true, C2H6: true, C2H4: true, C2H2: true, CO: true, TDCG: true
  });

  const handleLegendClick = (o) => {
    const { dataKey } = o;
    setVisible(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} onClick={onSampleSelect}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" fontSize={10} tickMargin={10} stroke="hsl(var(--ui-muted-foreground))" />
        <YAxis fontSize={12} stroke="hsl(var(--ui-muted-foreground))" />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--ui-popover) / 0.95)', border: '1px solid hsl(var(--ui-border))', borderRadius: 8, color: 'hsl(var(--ui-foreground))', backdropFilter: 'blur(12px)' }}
          formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]}
        />
        <Legend
          verticalAlign="top"
          height={56}
          wrapperStyle={{ paddingBottom: 12 }}
          onClick={handleLegendClick}
          cursor="pointer"
          formatter={(value, entry) => {
            const { dataKey } = entry;
            return <span style={{ opacity: visible[dataKey] ? 1 : 0.3, color: visible[dataKey] ? 'hsl(var(--ui-foreground))' : 'hsl(var(--ui-muted-foreground))', fontSize: 11 }}>{value}</span>;
          }}
        />
        <Line type="monotone" dataKey="H2" name="Hydrogen (H₂)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.H2} />
        <Line type="monotone" dataKey="CH4" name="Methane (CH₄)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.CH4} />
        <Line type="monotone" dataKey="C2H6" name="Ethane (C₂H₆)" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.C2H6} />
        <Line type="monotone" dataKey="C2H4" name="Ethylene (C₂H₄)" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.C2H4} />
        <Line type="monotone" dataKey="C2H2" name="Acetylene (C₂H₂)" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.C2H2} />
        <Line type="monotone" dataKey="CO" name="CO" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.CO} />
        <Line type="monotone" dataKey="TDCG" name="TDCG" stroke="hsl(var(--ui-muted-foreground))" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={{ r: 5 }} hide={!visible.TDCG} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// --- DASHBOARD CARD ---
const DashboardCard = ({ title, children, icon: Icon }) => (
  <Card variant="glass" className="overflow-hidden">
    <div className="flex justify-between items-center px-4 py-3 border-b border-border/50">
      <h3 className="font-semibold text-foreground text-[13px] m-0">{title}</h3>
      {Icon && <Icon size={18} className="text-muted-foreground" />}
    </div>
    <div className="p-3.5" style={{ height: 370 }}>
      {children}
    </div>
  </Card>
);

// --- CORROSION TOOLTIP ---
const CorrosionTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dbds = payload.find(p => p.name.includes('DBDS'));
    const passivator = payload.find(p => p.name.includes('Passivator'));
    const corrosion = payload.find(p => p.name.includes('Corrosion'));
    return (
      <div style={{ background: 'hsl(var(--ui-popover) / 0.95)', padding: 12, border: '1px solid hsl(var(--ui-border))', borderRadius: 8, fontSize: 13, color: 'hsl(var(--ui-foreground))', backdropFilter: 'blur(12px)' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#ef4444' }}>DBDS: {dbds ? dbds.value : 'N/A'} ppm</p>
        <p style={{ color: '#3b82f6' }}>Passivator: {passivator ? passivator.value : 0} ppm</p>
        <div style={{
          marginTop: 8, padding: '4px 8px', borderRadius: 4, textAlign: 'center', fontSize: 11, fontWeight: 700,
          background: corrosion && corrosion.value > 0 ? '#fef2f2' : '#f0fdf4',
          color: corrosion && corrosion.value > 0 ? '#b91c1c' : '#15803d'
        }}>
          {corrosion && corrosion.value > 0 ? '⚠ CORROSIVE' : 'NON-CORROSIVE'}
        </div>
      </div>
    );
  }
  return null;
};

// --- FULL HISTORY TABLE ---
const FullHistoryTable = ({ data }) => {
  const sortedData = [...data].reverse();
  const [dgaModal, setDgaModal] = useState(false);
  const [oilModal, setOilModal] = useState(false);

  useEffect(() => {
    if (!dgaModal && !oilModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setDgaModal(false); setOilModal(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dgaModal, oilModal]);

  const thBase = {
    padding: '8px 10px',
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  };
  const thDga = { ...thBase, background: 'rgba(16, 185, 129, 0.08)', color: '#6ee7b7' };
  const thTdcg = { ...thBase, background: 'rgba(59, 130, 246, 0.08)', color: '#93c5fd' };
  const thOil = { ...thBase, background: 'hsl(var(--ui-muted) / 0.5)', color: 'hsl(var(--ui-muted-foreground))' };
  const thChem = { ...thBase, background: 'rgba(139, 92, 246, 0.06)', color: '#c4b5fd' };
  const thAging = { ...thBase, background: 'rgba(236, 72, 153, 0.06)', color: '#f9a8d4' };
  const thSticky = { ...thBase, background: 'hsl(var(--ui-card) / 0.96)', color: 'hsl(var(--ui-foreground))', position: 'sticky', left: 0, zIndex: 3 };

  const tdBase = { padding: '6px 10px', textAlign: 'right', fontSize: 12, color: 'hsl(var(--ui-foreground) / 0.85)', whiteSpace: 'nowrap', borderBottom: '1px solid hsl(var(--ui-border) / 0.5)' };
  const tdSticky = { ...tdBase, position: 'sticky', left: 0, background: 'hsl(var(--ui-card) / 0.96)', fontWeight: 600, color: 'hsl(var(--ui-foreground))', zIndex: 1 };

  const modalOverlay = { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const modalBox = { background: 'hsl(var(--ui-card) / 0.92)', border: '1px solid hsl(var(--ui-border))', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', width: '98vw', maxWidth: '98vw', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backdropFilter: 'blur(24px)' };
  const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid hsl(var(--ui-border) / 0.5)', flexShrink: 0 };
  const closeBtn = { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'hsl(var(--ui-muted) / 0.5)', border: '1px solid hsl(var(--ui-border))', color: 'hsl(var(--ui-muted-foreground))', cursor: 'pointer' };
  const viewBtn = (color) => ({ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${color}14`, border: `1px solid ${color}33`, color, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 });

  // Big font styles for modals
  const thBig = { ...thBase, fontSize: 12, padding: '10px 14px' };
  const thDgaBig = { ...thBig, background: 'rgba(16, 185, 129, 0.08)', color: '#6ee7b7' };
  const thTdcgBig = { ...thBig, background: 'rgba(59, 130, 246, 0.08)', color: '#93c5fd' };
  const thOilBig = { ...thBig, background: 'rgba(15,23,42,0.9)', color: '#94a3b8' };
  const thChemBig = { ...thBig, background: 'rgba(139, 92, 246, 0.06)', color: '#c4b5fd' };
  const thAgingBig = { ...thBig, background: 'rgba(236, 72, 153, 0.06)', color: '#f9a8d4' };
  const thStickyBig = { ...thBig, background: 'hsl(var(--ui-card) / 0.96)', color: 'hsl(var(--ui-foreground))', position: 'sticky', left: 0, zIndex: 3 };
  const tdBig = { ...tdBase, fontSize: 14, padding: '8px 14px' };
  const tdStickyBig = { ...tdBig, position: 'sticky', left: 0, background: 'hsl(var(--ui-card) / 0.96)', fontWeight: 600, color: 'hsl(var(--ui-foreground))', zIndex: 1 };

  return (
    <>
    <Card variant="glass" className="overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Table size={14} className="text-muted-foreground" />
          <h3 className="font-semibold text-foreground text-[13px] m-0">Full Sample History</h3>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" style={viewBtn('#6ee7b7')} onClick={() => setDgaModal(true)}>
            <Zap size={12} /> DGA History
          </button>
          <button type="button" style={viewBtn('#94a3b8')} onClick={() => setOilModal(true)}>
            <FlaskConical size={12} /> Oil Analysis
          </button>
          <span className="text-[11px] text-muted-foreground italic ml-1.5">* Arrows indicate % change from previous sample</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSticky}>Date</th>
              <th style={thDga}>H₂</th>
              <th style={thDga}>CH₄</th>
              <th style={thDga}>C₂H₆</th>
              <th style={thDga}>C₂H₄</th>
              <th style={thDga}>C₂H₂</th>
              <th style={thDga}>CO</th>
              <th style={{ ...thTdcg, borderRight: '1px solid #334155' }}>TDCG</th>
              <th style={thOil}>Moisture</th>
              <th style={thOil}>BDV</th>
              <th style={thOil}>Acidity</th>
              <th style={thOil}>IFT</th>
              <th style={thOil}>Tan d</th>
              <th style={{ ...thOil, borderRight: '1px solid #334155' }}>Color</th>
              <th style={thChem}>Inhibitor</th>
              <th style={thChem}>DBDS</th>
              <th style={thChem}>Passivator</th>
              <th style={{ ...thChem, borderRight: '1px solid #334155' }}>Corr. S</th>
              <th style={thAging}>Furan</th>
              <th style={thAging}>Methanol</th>
              <th style={thAging}>DP (Furan)</th>
              <th style={thAging}>DP (Methanol)</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              const prev = sortedData[index + 1];
              return (
                <tr key={index}>
                  <td style={tdSticky}>{row.date}</td>
                  <td style={tdBase}>{row.H2} <TrendValue current={row.H2} previous={prev?.H2} /></td>
                  <td style={tdBase}>{row.CH4} <TrendValue current={row.CH4} previous={prev?.CH4} /></td>
                  <td style={tdBase}>{row.C2H6} <TrendValue current={row.C2H6} previous={prev?.C2H6} /></td>
                  <td style={tdBase}>{row.C2H4} <TrendValue current={row.C2H4} previous={prev?.C2H4} /></td>
                  <td style={tdBase}>{row.C2H2} <TrendValue current={row.C2H2} previous={prev?.C2H2} /></td>
                  <td style={tdBase}>{row.CO} <TrendValue current={row.CO} previous={prev?.CO} /></td>
                  <td style={{ ...tdBase, fontWeight: 700, color: '#93c5fd', background: 'rgba(59,130,246,0.08)', borderRight: '1px solid #334155' }}>
                    {row.TDCG} <TrendValue current={row.TDCG} previous={prev?.TDCG} />
                  </td>
                  <td style={tdBase}>{row.Moisture} <TrendValue current={row.Moisture} previous={prev?.Moisture} /></td>
                  <td style={tdBase}>{row.BDV} <TrendValue current={row.BDV} previous={prev?.BDV} type="inverse" /></td>
                  <td style={tdBase}>{formatChartMetricValue('Acidity', row.Acidity)} <TrendValue current={row.Acidity} previous={prev?.Acidity} /></td>
                  <td style={tdBase}>{row.IFT} <TrendValue current={row.IFT} previous={prev?.IFT} type="inverse" /></td>
                  <td style={tdBase}>{formatChartMetricValue('TanDelta', row.TanDelta)} <TrendValue current={row.TanDelta} previous={prev?.TanDelta} /></td>
                  <td style={{ ...tdBase, borderRight: '1px solid #334155' }}>{row.Color || '-'}</td>
                  <td style={tdBase}>
                    <span style={{ color: row.Inhibitor !== null && row.Inhibitor < 0.3 ? '#ef4444' : 'inherit', fontWeight: row.Inhibitor !== null && row.Inhibitor < 0.3 ? 700 : 400 }}>
                      {row.Inhibitor !== null ? formatChartMetricValue('Inhibitor', row.Inhibitor) : '-'}
                    </span>
                    <TrendValue current={row.Inhibitor} previous={prev?.Inhibitor} type="inverse" />
                  </td>
                  <td style={tdBase}>{row.DBDS || '-'} <TrendValue current={row.DBDS} previous={prev?.DBDS} /></td>
                  <td style={tdBase}>{row.Passivator || '-'} <TrendValue current={row.Passivator} previous={prev?.Passivator} /></td>
                  <td style={{ ...tdBase, borderRight: '1px solid #334155' }}>
                    {row.CopperCorr === 1
                      ? <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>FAIL</span>
                      : <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 10 }}>PASS</span>}
                  </td>
                  <td style={tdBase}>{row.Furan || '-'} <TrendValue current={row.Furan} previous={prev?.Furan} /></td>
                  <td style={tdBase}>{row.Methanol !== null ? formatChartMetricValue('Methanol', row.Methanol) : '-'} <TrendValue current={row.Methanol} previous={prev?.Methanol} /></td>
                  <td style={tdBase}>{row.DPFuran !== null ? row.DPFuran : '-'} <TrendValue current={row.DPFuran} previous={prev?.DPFuran} type="inverse" /></td>
                  <td style={tdBase}>{row.DPMethanol !== null ? row.DPMethanol : '-'} <TrendValue current={row.DPMethanol} previous={prev?.DPMethanol} type="inverse" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>

    {/* DGA History Modal */}
    {dgaModal && (
      <div style={modalOverlay} onClick={() => setDgaModal(false)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} style={{ color: '#6ee7b7' }} />
              <h3 style={{ fontWeight: 700, color: 'hsl(var(--ui-foreground))', fontSize: 16, margin: 0 }}>DGA Full Sample History</h3>
              <span style={{ fontSize: 12, color: 'hsl(var(--ui-muted-foreground))' }}>({sortedData.length} samples)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--ui-muted-foreground))', fontStyle: 'italic' }}>* Arrows indicate % change from previous sample</span>
              <button type="button" style={closeBtn} onClick={() => setDgaModal(false)}>Close</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStickyBig}>Date</th>
                  <th style={thDgaBig}>H₂</th>
                  <th style={thDgaBig}>CH₄</th>
                  <th style={thDgaBig}>C₂H₆</th>
                  <th style={thDgaBig}>C₂H₄</th>
                  <th style={thDgaBig}>C₂H₂</th>
                  <th style={thDgaBig}>CO</th>
                  <th style={thTdcgBig}>TDCG</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, index) => {
                  const prev = sortedData[index + 1];
                  return (
                    <tr key={index} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.03)' }}>
                      <td style={tdStickyBig}>{row.date}</td>
                      <td style={tdBig}>{row.H2} <TrendValue current={row.H2} previous={prev?.H2} /></td>
                      <td style={tdBig}>{row.CH4} <TrendValue current={row.CH4} previous={prev?.CH4} /></td>
                      <td style={tdBig}>{row.C2H6} <TrendValue current={row.C2H6} previous={prev?.C2H6} /></td>
                      <td style={tdBig}>{row.C2H4} <TrendValue current={row.C2H4} previous={prev?.C2H4} /></td>
                      <td style={tdBig}>{row.C2H2} <TrendValue current={row.C2H2} previous={prev?.C2H2} /></td>
                      <td style={tdBig}>{row.CO} <TrendValue current={row.CO} previous={prev?.CO} /></td>
                      <td style={{ ...tdBig, fontWeight: 700, color: '#93c5fd', background: 'rgba(59,130,246,0.08)' }}>
                        {row.TDCG} <TrendValue current={row.TDCG} previous={prev?.TDCG} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    {/* Oil Analysis Modal */}
    {oilModal && (
      <div style={modalOverlay} onClick={() => setOilModal(false)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={18} style={{ color: 'hsl(var(--ui-muted-foreground))' }} />
              <h3 style={{ fontWeight: 700, color: 'hsl(var(--ui-foreground))', fontSize: 16, margin: 0 }}>Oil Analysis Full Sample History</h3>
              <span style={{ fontSize: 12, color: 'hsl(var(--ui-muted-foreground))' }}>({sortedData.length} samples)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--ui-muted-foreground))', fontStyle: 'italic' }}>* Arrows indicate % change from previous sample</span>
              <button type="button" style={closeBtn} onClick={() => setOilModal(false)}>Close</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStickyBig}>Date</th>
                  <th style={thOilBig}>Moisture</th>
                  <th style={thOilBig}>BDV</th>
                  <th style={thOilBig}>Acidity</th>
                  <th style={thOilBig}>IFT</th>
                  <th style={thOilBig}>Tan D</th>
                  <th style={{ ...thOilBig, borderRight: '1px solid #334155' }}>Color</th>
                  <th style={thChemBig}>Inhibitor</th>
                  <th style={thChemBig}>DBDS</th>
                  <th style={thChemBig}>Passivator</th>
                  <th style={{ ...thChemBig, borderRight: '1px solid #334155' }}>Corr. S</th>
                  <th style={thAgingBig}>Furan</th>
                  <th style={thAgingBig}>Methanol</th>
                  <th style={thAgingBig}>DP (Furan)</th>
                  <th style={thAgingBig}>DP (Methanol)</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, index) => {
                  const prev = sortedData[index + 1];
                  return (
                    <tr key={index} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(148,163,184,0.03)' }}>
                      <td style={tdStickyBig}>{row.date}</td>
                      <td style={tdBig}>{row.Moisture} <TrendValue current={row.Moisture} previous={prev?.Moisture} /></td>
                      <td style={tdBig}>{row.BDV} <TrendValue current={row.BDV} previous={prev?.BDV} type="inverse" /></td>
                      <td style={tdBig}>{formatChartMetricValue('Acidity', row.Acidity)} <TrendValue current={row.Acidity} previous={prev?.Acidity} /></td>
                      <td style={tdBig}>{row.IFT} <TrendValue current={row.IFT} previous={prev?.IFT} type="inverse" /></td>
                      <td style={tdBig}>{formatChartMetricValue('TanDelta', row.TanDelta)} <TrendValue current={row.TanDelta} previous={prev?.TanDelta} /></td>
                      <td style={{ ...tdBig, borderRight: '1px solid #334155' }}>{row.Color || '-'}</td>
                      <td style={tdBig}>
                        <span style={{ color: row.Inhibitor !== null && row.Inhibitor < 0.3 ? '#ef4444' : 'inherit', fontWeight: row.Inhibitor !== null && row.Inhibitor < 0.3 ? 700 : 400 }}>
                          {row.Inhibitor !== null ? formatChartMetricValue('Inhibitor', row.Inhibitor) : '-'}
                        </span>
                        <TrendValue current={row.Inhibitor} previous={prev?.Inhibitor} type="inverse" />
                      </td>
                      <td style={tdBig}>{row.DBDS || '-'} <TrendValue current={row.DBDS} previous={prev?.DBDS} /></td>
                      <td style={tdBig}>{row.Passivator || '-'} <TrendValue current={row.Passivator} previous={prev?.Passivator} /></td>
                      <td style={{ ...tdBig, borderRight: '1px solid #334155' }}>
                        {row.CopperCorr === 1
                          ? <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>FAIL</span>
                          : <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>PASS</span>}
                      </td>
                      <td style={tdBig}>{row.Furan || '-'} <TrendValue current={row.Furan} previous={prev?.Furan} /></td>
                      <td style={tdBig}>{row.Methanol !== null ? formatChartMetricValue('Methanol', row.Methanol) : '-'} <TrendValue current={row.Methanol} previous={prev?.Methanol} /></td>
                      <td style={tdBig}>{row.DPFuran !== null ? row.DPFuran : '-'} <TrendValue current={row.DPFuran} previous={prev?.DPFuran} type="inverse" /></td>
                      <td style={tdBig}>{row.DPMethanol !== null ? row.DPMethanol : '-'} <TrendValue current={row.DPMethanol} previous={prev?.DPMethanol} type="inverse" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// --- MAIN COMPONENT ---
export default function DataChartTrending({ records, transformer, approvedHistory = [] }) {
  const assessmentLookup = useMemo(() => buildAssessmentLookup(approvedHistory), [approvedHistory]);
  const chartData = useMemo(() => mapRecordsToChartData(records, assessmentLookup), [records, assessmentLookup]);
  const [selectedSampleDate, setSelectedSampleDate] = useState('');

  useEffect(() => {
    if (!chartData.length) return;
    if (!chartData.some((row) => row.sampleDate === selectedSampleDate)) {
      setSelectedSampleDate(chartData[chartData.length - 1].sampleDate);
    }
  }, [chartData, selectedSampleDate]);

  if (!records || records.length === 0) {
    return (
      <Card variant="glass" className="p-10 text-center">
        <svg style={{ width: 48, height: 48, margin: '0 auto 16px', color: 'hsl(var(--ui-muted-foreground))' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-foreground font-semibold text-[15px]">No Oil Test Data Available</p>
        <span className="text-muted-foreground text-[13px]">Add oil test records to see trending charts</span>
      </Card>
    );
  }

  const tooltipStyle = { background: 'hsl(var(--ui-popover) / 0.95)', border: '1px solid hsl(var(--ui-border))', borderRadius: 8, color: 'hsl(var(--ui-foreground))', backdropFilter: 'blur(12px)' };
  const selectedSample = chartData.find((row) => row.sampleDate === selectedSampleDate) || chartData[chartData.length - 1];

  const formatDate = (dateEnergized) => {
    if (!dateEnergized) return '-';
    const d = new Date(dateEnergized);
    if (isNaN(d.getTime())) return dateEnergized;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleSampleSelect = (state) => {
    const payload = state?.activePayload?.find((entry) => entry?.payload?.sampleDate)?.payload
      || state?.activePayload?.[0]?.payload;
    const activeIndex = Number.isInteger(state?.activeTooltipIndex)
      ? state.activeTooltipIndex
      : (state?.activeTooltipIndex !== undefined && state?.activeTooltipIndex !== null && !Number.isNaN(Number(state.activeTooltipIndex))
        ? Number(state.activeTooltipIndex)
        : null);
    const indexedSample = activeIndex !== null ? chartData[activeIndex] : null;
    const labelMatchedSample = chartData.find((row) => row.date === state?.activeLabel);
    const sampleDate = payload?.sampleDate || indexedSample?.sampleDate || labelMatchedSample?.sampleDate;

    if (sampleDate && sampleDate !== selectedSampleDate) {
      setSelectedSampleDate(sampleDate);
    }
  };

  const renderSelectionGuide = () => null;

  return (
    <div className="flex flex-col gap-4">
      {/* Asset Info Banner */}
      {transformer && (
        <Card variant="glass" className="px-5 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Zap size={20} style={{ color: '#0d9488' }} />
            <div>
              <h2 className="text-foreground text-base font-extrabold m-0">
                {transformer.name || 'Transformer'} ({transformer.mnemonic || '-'})
              </h2>
              <p className="text-muted-foreground text-xs m-0">
                Serial: {transformer.serialNumber || '-'} | {transformer.loadMVA || '-'} MVA | {transformer.voltage || '-'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border/60 bg-muted/30">
              Maker: {transformer.maker || transformer.brand || '-'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border/60 bg-muted/30">
              Oil Brand: {transformer.oilBrand || "-"}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border/60 bg-muted/30">
              {chartData.length} Samples
            </span>
          </div>
        </Card>
      )}

      <Card variant="glass" className="px-5 py-4">
        <div className="flex justify-between items-start gap-3 flex-wrap mb-2.5">
          <div>
            <div className="text-muted-foreground text-[11px] mb-1">Assessment on Selected Date</div>
            <div className="text-brand text-sm font-extrabold">
              {selectedSample?.date || '-'}
            </div>
          </div>
          <div className="text-muted-foreground text-[11px]">
            Click any chart point, line, or bar to load the saved assessment for that sample.
          </div>
        </div>

        {selectedSample?.assessmentText ? (
          <div className="text-foreground/90 text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto pr-1">
            {selectedSample.assessmentText}
          </div>
        ) : (
          <div className="text-muted-foreground text-[12.5px]">
            No manual or generated assessment is saved for this sample date.
          </div>
        )}
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))' }}>

        {/* 1. DGA Fault Gases & TDCG */}
        <DashboardCard title="DGA: Fault Gases & TDCG (Click Legend to Toggle)" icon={Activity}>
          <DynamicDGAChart data={chartData} onSampleSelect={handleSampleSelect} />
        </DashboardCard>

        {/* 2. DBDS & Copper Corrosion only */}
        <DashboardCard title="DBDS & Copper Corrosion" icon={AlertOctagon}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" label={{ value: 'DBDS (ppm)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="right" orientation="right" type="number" domain={[0, 1]} tickFormatter={(val) => val === 1 ? 'Fail' : 'Pass'} stroke="hsl(var(--ui-muted-foreground))" />
              <Tooltip content={<CorrosionTooltip />} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <Bar yAxisId="left" dataKey="DBDS" name="DBDS (ppm)" fill="#ef4444" barSize={20} radius={[4, 4, 0, 0]} />
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

        {/* 3. PCB, Passivator & DBPC (Inhibitor) */}
        <DashboardCard title="PCB, Passivator & DBPC Inhibitor" icon={Shield}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" label={{ value: 'ppm', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'DBPC (%)', angle: 90, position: 'insideRight', fill: 'hsl(var(--ui-muted-foreground))' }} domain={[0, 0.6]} stroke="#10b981" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={46} wrapperStyle={{ paddingBottom: 8 }} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <Bar yAxisId="left" dataKey="PCB" name="PCB (ppm)" fill="#f43f5e" barSize={14} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              <Bar yAxisId="left" dataKey="Passivator" name="Passivator (ppm)" fill="#3b82f6" barSize={14} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              <Line yAxisId="right" type="stepAfter" dataKey="Inhibitor" name="DBPC Content (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              <ReferenceLine yAxisId="right" y={0.30} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: 'Re-inhibit', fill: '#f59e0b', fontSize: 9 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 4. IFT & Acidity */}
        <DashboardCard title="IFT & Acidity" icon={Zap}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" label={{ value: 'IFT (mN/m)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} domain={[0, 60]} stroke="#8b5cf6" />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Acidity (mgKOH/g)', angle: 90, position: 'insideRight', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#f43f5e" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <Area yAxisId="left" type="monotone" dataKey="IFT" name="IFT (mN/m)" fill="#8b5cf6" fillOpacity={0.1} stroke="#8b5cf6" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="Acidity" name="Acidity (mgKOH/g)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 5. Resistivity & Tan Delta */}
        <DashboardCard title="Resistivity & Tan Delta" icon={FlaskConical}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" stroke="#84cc16" label={{ value: 'Resistivity (GΩ·m)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" label={{ value: 'Tan Delta', angle: 90, position: 'insideRight', fill: 'hsl(var(--ui-muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              <Area yAxisId="left" type="monotone" dataKey="Resistivity" name="Resistivity (GΩ·m)" fill="#84cc16" fillOpacity={0.1} stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} />
              {renderSelectionGuide()}
              <Line yAxisId="right" type="monotone" dataKey="TanDelta" name="Tan Delta" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 6. 2-FAL & Methanol */}
        <DashboardCard title="Paper Aging: 2-FAL & Methanol" icon={FileText}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" label={{ value: '2-FAL (ppb)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#8b5cf6" />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Methanol (ppb)', angle: 90, position: 'insideRight', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#ec4899" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <Line yAxisId="left" type="monotone" dataKey="Furan" name="2-FAL (ppb)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="Methanol" name="Methanol (ppb)" stroke="#ec4899" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 7. Est. DP from Furan & Methanol */}
        <DashboardCard title="Estimated DP: Furan & Methanol Methods" icon={FileText}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis domain={[200, 1000]} label={{ value: 'Est. DP Value', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="hsl(var(--ui-muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <ReferenceLine y={400} stroke="#ef4444" strokeDasharray="4 3" label={{ position: 'right', value: 'End of Life', fill: '#ef4444', fontSize: 9 }} />
              <ReferenceLine y={600} stroke="#f59e0b" strokeDasharray="4 3" label={{ position: 'right', value: 'Moderate', fill: '#f59e0b', fontSize: 9 }} />
              <Line type="monotone" dataKey="DPFuran" name="Est. DP (Furan)" stroke="#64748b" strokeWidth={2.5} strokeDasharray="10 4" dot={{ r: 4, fill: '#64748b' }} />
              <Line type="monotone" dataKey="DPMethanol" name="Est. DP (Methanol)" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 8. Flash Point (Pensky) + Flash Point Open Cup + Fire Point Open Cup */}
        <DashboardCard title="Flash Point & Fire Point" icon={Zap}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="hsl(var(--ui-muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={46} wrapperStyle={{ paddingBottom: 8 }} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              <ReferenceLine y={130} stroke="hsl(var(--ui-muted-foreground))" strokeDasharray="4 3" label={{ position: 'right', value: 'Min. 130°C', fill: 'hsl(var(--ui-muted-foreground))', fontSize: 9 }} />
              <Line type="monotone" dataKey="FlashPoint" name="Flash Point Pensky (°C)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="FlashPointOC" name="Flash Point Open Cup (°C)" stroke="#fb923c" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: '#fb923c' }} />
              <Line type="monotone" dataKey="FirePointOC" name="Fire Point Open Cup (°C)" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 4, fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 9. Density, Specific Gravity & ASTM Color */}
        <DashboardCard title="Density, Specific Gravity & ASTM Color" icon={FlaskConical}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis yAxisId="left" label={{ value: 'Density (kg/m³)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#06b6d4" />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Sp. Gravity / Color', angle: 90, position: 'insideRight', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#14b8a6" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={46} wrapperStyle={{ paddingBottom: 8 }} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              <Area yAxisId="left" type="monotone" dataKey="Density" name="Density (kg/m³)" fill="#06b6d4" fillOpacity={0.12} stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="SpecificGravity" name="Specific Gravity" stroke="#14b8a6" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
              {renderSelectionGuide()}
              <Bar yAxisId="right" dataKey="ColorValue" name="ASTM Color" fill="#fbbf24" barSize={16} radius={[4, 4, 0, 0]} fillOpacity={0.75} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* 10. Viscosity @40°C */}
        <DashboardCard title="Viscosity @40°C" icon={Activity}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} connectNulls onClick={handleSampleSelect}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--ui-muted-foreground))" />
              <YAxis label={{ value: 'Viscosity (cSt)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--ui-muted-foreground))' }} stroke="#3b82f6" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [formatChartMetricValue(item?.dataKey || name, value), name]} />
              <Legend verticalAlign="top" height={36} formatter={(v) => <span style={{ color: 'hsl(var(--ui-foreground))', fontSize: 11 }}>{v}</span>} />
              {renderSelectionGuide()}
              <ReferenceLine y={11} stroke="#10b981" strokeDasharray="4 3" label={{ position: 'right', value: 'Typ. Max (11 cSt)', fill: '#10b981', fontSize: 9 }} />
              <Area type="monotone" dataKey="Viscosity" name="Viscosity @40°C (cSt)" fill="#3b82f6" fillOpacity={0.12} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </DashboardCard>

      </div>

      {/* Full History Table */}
      <FullHistoryTable data={chartData} />
    </div>
  );
}
