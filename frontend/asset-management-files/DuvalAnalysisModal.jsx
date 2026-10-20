import React, { useState, useMemo, useCallback } from 'react';

// === Dark-themed Card ===
const Card = ({ children, style }) => (
  <div style={{
    background: '#1e1e1e',
    borderRadius: '16px',
    border: '1px solid #333',
    padding: '24px',
    ...style
  }}>
    {children}
  </div>
);

// === Constants ===
const GAS_COLORS = { H2: '#3b82f6', CH4: '#22c55e', C2H6: '#f59e0b', C2H4: '#ef4444', C2H2: '#8b5cf6', CO: '#06b6d4', CO2: '#ec4899' };
const GAS_NAMES = { H2: 'Hydrogen', CH4: 'Methane', C2H6: 'Ethane', C2H4: 'Ethylene', C2H2: 'Acetylene', CO: 'Carbon Monoxide', CO2: 'Carbon Dioxide', O2: 'Oxygen', N2: 'Nitrogen' };
const FAULT_DESC = {
  'PD': { name: 'Partial Discharge', color: '#3b82f6' },
  'T1': { name: 'Thermal < 300°C', color: '#22c55e' },
  'T2': { name: 'Thermal 300-700°C', color: '#eab308' },
  'T3': { name: 'Thermal > 700°C', color: '#f97316' },
  'T2-H': { name: 'Thermal 300-700°C', color: '#eab308' },
  'T3-H': { name: 'Thermal > 700°C', color: '#f97316' },
  'D1': { name: 'Low Energy Discharge', color: '#ef4444' },
  'D2': { name: 'High Energy Discharge', color: '#dc2626' },
  'DT': { name: 'Mixed Fault', color: '#8b5cf6' },
  'S': { name: 'Stray Gassing', color: '#06b6d4' },
  'O': { name: 'Overheating', color: '#84cc16' },
  'C': { name: 'Carbonization', color: '#f59e0b' },
  'ND': { name: 'Not Determined', color: '#94a3b8' }
};
const STATUS_DESC = {
  1: { name: 'Normal', color: '#22c55e', bg: '#22c55e20' },
  2: { name: 'Caution', color: '#f59e0b', bg: '#f59e0b20' },
  3: { name: 'Warning', color: '#ef4444', bg: '#ef444420' }
};

// === Utility functions ===
const parseGas = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };

const getAgeLimits = (age, o2n2) => {
  if (o2n2 <= 0.2) {
    if (age === null || age < 1) {
      return { table1: { H2: 100, CH4: 90, C2H6: 90, C2H4: 50, C2H2: 2, CO: 350, CO2: 2500 }, table2: { H2: 200, CH4: 180, C2H6: 180, C2H4: 100, C2H2: 4, CO: 570, CO2: 4000 } };
    } else if (age >= 1 && age < 10) {
      return { table1: { H2: 75, CH4: 45, C2H6: 30, C2H4: 20, C2H2: 1, CO: 350, CO2: 2500 }, table2: { H2: 150, CH4: 90, C2H6: 60, C2H4: 40, C2H2: 2, CO: 570, CO2: 4000 } };
    } else if (age >= 10 && age < 30) {
      return { table1: { H2: 100, CH4: 90, C2H6: 90, C2H4: 50, C2H2: 2, CO: 500, CO2: 3500 }, table2: { H2: 200, CH4: 180, C2H6: 180, C2H4: 100, C2H2: 4, CO: 800, CO2: 5500 } };
    } else {
      return { table1: { H2: 999999, CH4: 110, C2H6: 150, C2H4: 90, C2H2: 2, CO: 700, CO2: 4500 }, table2: { H2: 999999, CH4: 220, C2H6: 300, C2H4: 180, C2H2: 4, CO: 1000, CO2: 7000 } };
    }
  } else {
    return { table1: { H2: 100, CH4: 120, C2H6: 65, C2H4: 50, C2H2: 1, CO: 500, CO2: 5000 }, table2: { H2: 200, CH4: 240, C2H6: 130, C2H4: 100, C2H2: 2, CO: 800, CO2: 7500 } };
  }
};

const calcStatus = (gv, age, o2n2) => {
  const limits = getAgeLimits(age, o2n2);
  let s2 = false, s1 = false;
  const t = parseGas(gv.H2) + parseGas(gv.CH4) + parseGas(gv.C2H6) + parseGas(gv.C2H4) + parseGas(gv.C2H2) + parseGas(gv.CO);
  ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO', 'CO2'].forEach(g => {
    const v = parseGas(gv[g]);
    if (v > limits.table2[g]) s2 = true;
    if (v > limits.table1[g]) s1 = true;
  });
  if (t > 1920) return 3;
  if (t > 720) return s2 ? 3 : 2;
  return s2 ? 3 : s1 ? 2 : 1;
};

const calcDuval1 = (gv) => {
  const ch4 = parseGas(gv.CH4), c2h4 = parseGas(gv.C2H4), c2h2 = parseGas(gv.C2H2), total = ch4 + c2h4 + c2h2;
  if (total === 0) return null;
  const pctCH4 = (ch4 / total) * 100, pctC2H4 = (c2h4 / total) * 100, pctC2H2 = (c2h2 / total) * 100;
  let faultZone = 'T1';
  if (pctCH4 >= 98) faultZone = 'PD';
  else if (pctC2H4 >= 50 && pctC2H2 < 15) faultZone = 'T3';
  else if (pctC2H2 >= 13) { faultZone = pctC2H4 < 23 ? 'D1' : 'D2'; }
  else if (pctC2H2 >= 4) faultZone = 'DT';
  else if (pctC2H4 >= 20) faultZone = 'T2';
  return { pctCH4, pctC2H4, pctC2H2, faultZone };
};

// ============================================================
// DuvalAnalysisModal — Input, Duval, Assessment (dark themed)
// ============================================================
export default function DuvalAnalysisModal({ initialGases, initialTransformer }) {
  // --- State ---
  const [gasValues, setGasValues] = useState({
    H2: String(initialGases?.H2 ?? ''),
    CH4: String(initialGases?.CH4 ?? ''),
    C2H6: String(initialGases?.C2H6 ?? ''),
    C2H4: String(initialGases?.C2H4 ?? ''),
    C2H2: String(initialGases?.C2H2 ?? ''),
    CO: String(initialGases?.CO ?? ''),
    CO2: String(initialGases?.CO2 ?? ''),
    O2: String(initialGases?.O2 ?? ''),
    N2: String(initialGases?.N2 ?? ''),
  });

  const [transformerInfo] = useState({
    siteLocation: initialTransformer?.location || '',
    samplingPoint: 'Main Tank',
    mnemonic: initialTransformer?.mnemonic || '',
    serialNumber: initialTransformer?.serialNo || '',
    manufacturer: initialTransformer?.manufacturer || '',
    voltage: initialTransformer?.voltage || '',
    mvaRating: initialTransformer?.rating || '',
    yearBuilt: initialTransformer?.yearMfg || '',
    sampleDate: initialTransformer?.sampleDate || '',
    oilTemperature: '',
  });

  const [activeTab, setActiveTab] = useState('input');
  const [activeDuvalTab, setActiveDuvalTab] = useState('T1');

  // --- Derived values ---
  const o2n2Ratio = useMemo(() => {
    const o2 = parseGas(gasValues.O2), n2 = parseGas(gasValues.N2);
    return n2 === 0 ? 0 : o2 / n2;
  }, [gasValues.O2, gasValues.N2]);

  const tdcg = useMemo(() =>
    parseGas(gasValues.H2) + parseGas(gasValues.CH4) + parseGas(gasValues.C2H6) +
    parseGas(gasValues.C2H4) + parseGas(gasValues.C2H2) + parseGas(gasValues.CO),
    [gasValues]
  );

  const transformerAge = useMemo(() => {
    if (!transformerInfo.yearBuilt) return null;
    const year = parseInt(transformerInfo.yearBuilt);
    return isNaN(year) ? null : new Date().getFullYear() - year;
  }, [transformerInfo.yearBuilt]);

  const ageLimits = useMemo(() => getAgeLimits(transformerAge, o2n2Ratio), [transformerAge, o2n2Ratio]);
  const table1Norms = ageLimits.table1;
  const table2Norms = ageLimits.table2;

  const dgaStatus = useMemo(() => calcStatus(gasValues, transformerAge, o2n2Ratio), [gasValues, transformerAge, o2n2Ratio]);

  const duvalTriangle1 = useMemo(() => calcDuval1(gasValues), [gasValues]);

  const duvalTriangle4 = useMemo(() => {
    const h2 = parseGas(gasValues.H2), ch4 = parseGas(gasValues.CH4), c2h6 = parseGas(gasValues.C2H6), total = h2 + ch4 + c2h6;
    if (total === 0) return null;
    const pctH2 = (h2 / total) * 100, pctCH4 = (ch4 / total) * 100, pctC2H6 = (c2h6 / total) * 100;
    let faultZone = 'S';
    if (pctH2 >= 90) faultZone = 'PD';
    else if (pctCH4 >= 64) faultZone = 'C';
    else if (pctC2H6 >= 52) faultZone = 'O';
    return { pctH2, pctCH4, pctC2H6, faultZone };
  }, [gasValues]);

  const duvalTriangle5 = useMemo(() => {
    const ch4 = parseGas(gasValues.CH4), c2h4 = parseGas(gasValues.C2H4), c2h6 = parseGas(gasValues.C2H6), total = ch4 + c2h4 + c2h6;
    if (total === 0) return null;
    const pctCH4 = (ch4 / total) * 100, pctC2H4 = (c2h4 / total) * 100, pctC2H6 = (c2h6 / total) * 100;
    let faultZone = 'ND';
    if (pctCH4 >= 98) faultZone = 'PD';
    else if (pctC2H4 >= 50) faultZone = 'T3-H';
    else if (pctCH4 >= 35 && pctCH4 <= 75 && pctC2H4 >= 10 && pctC2H4 < 40) faultZone = 'C';
    else if (pctC2H4 >= 20) faultZone = 'T2-H';
    else if (pctC2H6 >= 50) faultZone = 'S';
    else if (pctCH4 >= 40) faultZone = 'O';
    return { pctCH4, pctC2H4, pctC2H6, faultZone };
  }, [gasValues]);

  const duvalPentagon1 = useMemo(() => {
    const h2 = parseGas(gasValues.H2), ch4 = parseGas(gasValues.CH4), c2h6 = parseGas(gasValues.C2H6),
      c2h4 = parseGas(gasValues.C2H4), c2h2 = parseGas(gasValues.C2H2), total = h2 + ch4 + c2h6 + c2h4 + c2h2;
    if (total === 0) return null;
    const pctH2 = (h2 / total) * 100, pctCH4 = (ch4 / total) * 100, pctC2H6 = (c2h6 / total) * 100,
      pctC2H4 = (c2h4 / total) * 100, pctC2H2 = (c2h2 / total) * 100;
    let faultZone = 'S';
    if (pctH2 > 85) faultZone = 'PD';
    else if (pctC2H2 > 20) faultZone = pctC2H4 > 20 ? 'D2' : 'D1';
    else if (pctC2H4 > 50) faultZone = 'T3-H';
    else if (pctCH4 > 45 && pctC2H4 >= 10 && pctC2H4 < 30) faultZone = 'C';
    else if (pctC2H4 > 20) faultZone = 'T2-H';
    else if (pctC2H6 > 35 && pctCH4 < 50) faultZone = 'O';
    else if (pctCH4 > 50) faultZone = 'T1';
    return { pctH2, pctCH4, pctC2H6, pctC2H4, pctC2H2, faultZone };
  }, [gasValues]);

  const rogersRatios = useMemo(() => {
    const ch4 = parseGas(gasValues.CH4), h2 = parseGas(gasValues.H2), c2h4 = parseGas(gasValues.C2H4),
      c2h6 = parseGas(gasValues.C2H6), c2h2 = parseGas(gasValues.C2H2);
    if (h2 === 0 || c2h4 === 0 || c2h6 === 0) return null;
    const r1 = c2h2 / c2h4, r2 = ch4 / h2, r3 = c2h4 / c2h6;
    let diagnosis = 'Undetermined';
    if (r1 < 0.1 && r2 >= 0.1 && r2 <= 1.0 && r3 < 1.0) diagnosis = 'Normal Aging';
    else if (r1 < 0.1 && r2 < 0.1) diagnosis = 'Partial Discharge';
    else if (r1 >= 0.1 && r1 <= 3.0 && r3 > 3.0) diagnosis = 'Arcing Fault';
    else if (r1 < 0.1 && r2 > 1.0 && r3 <= 3.0) diagnosis = 'Thermal < 700°C';
    else if (r1 < 0.1 && r2 > 1.0 && r3 > 3.0) diagnosis = 'Thermal > 700°C';
    return { r1, r2, r3, diagnosis };
  }, [gasValues]);

  const co2coRatio = useMemo(() => {
    const co = parseGas(gasValues.CO), co2 = parseGas(gasValues.CO2);
    if (co === 0) return null;
    const ratio = co2 / co;
    let interpretation = 'Normal';
    let severity = 'normal';
    if (ratio < 3) { interpretation = 'Thermal fault in cellulose'; severity = 'warning'; }
    return { ratio, interpretation, severity };
  }, [gasValues]);

  const gasAnalysis = useMemo(() => {
    const analysis = [];
    const msgs = {
      H2: 'Hydrogen - partial discharge or overheating',
      CH4: 'Methane - low-temp decomposition',
      C2H6: 'Ethane - thermal 200-400°C',
      C2H4: 'Ethylene - high-temp fault',
      C2H2: 'Acetylene - CRITICAL: arcing!',
      CO: 'CO - cellulose degradation'
    };
    ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO'].forEach(g => {
      const v = parseGas(gasValues[g]);
      if (v > table1Norms[g]) {
        analysis.push({
          gas: g, level: v > table2Norms[g] ? 'High' : 'Elevated',
          message: msgs[g], color: v > table2Norms[g] ? '#ef4444' : '#f59e0b'
        });
      }
    });
    return analysis;
  }, [gasValues, table1Norms, table2Norms]);

  const ieeeAssessment = useMemo(() => {
    const fault = duvalTriangle1?.faultZone;
    let condition, action, interval, recommendations = [];
    if (dgaStatus === 1) { condition = 'Normal'; action = 'Continue operation'; interval = 'Annual'; recommendations = ['Maintain routine schedule']; }
    else if (dgaStatus === 2) { condition = 'Caution'; action = 'Increase monitoring'; interval = 'Quarterly'; recommendations = ['Increase sampling frequency', 'Review history']; }
    else { condition = 'Warning'; action = 'Investigation required'; interval = 'Monthly'; recommendations = ['Engineering review', 'Consider load reduction', 'Inspection needed']; }
    if (fault === 'D1' || fault === 'D2') recommendations.push('Check connections');
    if (fault === 'T3') recommendations.push('Inspect for hot spots');
    if (fault === 'PD') recommendations.push('Check insulation');
    return { condition, action, interval, recommendations };
  }, [dgaStatus, duvalTriangle1]);

  const handleGasChange = useCallback((g, v) => setGasValues(p => ({ ...p, [g]: v })), []);

  // --- Tab config ---
  const tabs = [
    { id: 'input', label: 'Input', icon: '📝' },
    { id: 'duval', label: 'Duval', icon: '🔺' },
    { id: 'assessment', label: 'Assessment', icon: '📋' },
  ];

  // ========== RENDER ==========
  return (
    <div style={{ minHeight: '100%', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0' }}>

      {/* Tab bar */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0 24px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '14px 22px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === t.id ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === t.id ? '#3b82f6' : '#999',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>

        {/* =============== INPUT TAB =============== */}
        {activeTab === 'input' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px' }}>

              {/* Transformer Info */}
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: '#e0e0e0' }}>🏭 Transformer Info</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {[
                    ['Site', 'siteLocation'], ['Serial No.', 'serialNumber'], ['Mnemonic', 'mnemonic'],
                    ['MVA', 'mvaRating'], ['Voltage', 'voltage'], ['Year Built', 'yearBuilt'],
                    ['Sample Date', 'sampleDate'], ['Manufacturer', 'manufacturer']
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: '13px', color: '#999', display: 'block', marginBottom: '5px', fontWeight: '500' }}>{label}</label>
                      <input
                        type="text"
                        value={transformerInfo[field]}
                        readOnly
                        style={{
                          width: '100%', padding: '10px 12px', background: '#2a2a2a', border: '1px solid #444',
                          borderRadius: '8px', fontSize: '14px', color: '#ccc', boxSizing: 'border-box',
                          cursor: 'default'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Gas Values */}
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: '#e0e0e0' }}>🧪 Gas Values (ppm)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO', 'CO2', 'O2', 'N2'].map(g => (
                    <div key={g} style={{ background: '#2a2a2a', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: GAS_COLORS[g] || '#94a3b8' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#e0e0e0' }}>{g}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{GAS_NAMES[g]}</div>
                      <input
                        type="number"
                        value={gasValues[g]}
                        onChange={e => handleGasChange(g, e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #444',
                          borderRadius: '6px', fontSize: '16px', fontFamily: 'monospace', boxSizing: 'border-box',
                          color: '#e0e0e0'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Summary row */}
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '14px', background: '#2a2a2a', borderRadius: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>O₂/N₂</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>
                      {o2n2Ratio.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ padding: '14px', background: o2n2Ratio <= 0.2 ? '#22c55e15' : '#f59e0b15', borderRadius: '10px', border: `1px solid ${o2n2Ratio <= 0.2 ? '#22c55e40' : '#f59e0b40'}` }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Type</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>
                      {o2n2Ratio <= 0.2 ? 'Sealed' : 'Breathing'}
                    </div>
                  </div>
                  <div style={{ padding: '14px', background: tdcg > 720 ? '#f59e0b15' : '#22c55e15', borderRadius: '10px', border: `1px solid ${tdcg > 720 ? '#f59e0b40' : '#22c55e40'}` }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>TDCG</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: tdcg > 720 ? '#f59e0b' : '#22c55e' }}>
                      {tdcg} <span style={{ fontSize: '12px', fontWeight: '400' }}>ppm</span>
                    </div>
                  </div>
                </div>

                {/* Analyze button */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  <button
                    onClick={() => setActiveTab('duval')}
                    style={{
                      flex: 1, padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    🔺 View Duval Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('assessment')}
                    style={{
                      flex: 1, padding: '14px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    📋 View Assessment
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* =============== DUVAL TAB =============== */}
        {activeTab === 'duval' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[['T1', 'Triangle 1'], ['T4', 'Triangle 4'], ['T5', 'Triangle 5'], ['P1', 'Pentagon']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveDuvalTab(id)}
                  style={{
                    padding: '12px 24px',
                    background: activeDuvalTab === id ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e1e1e',
                    border: activeDuvalTab === id ? 'none' : '1px solid #444',
                    borderRadius: '10px',
                    color: activeDuvalTab === id ? '#fff' : '#999',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              {/* Triangle / Pentagon image */}
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {(() => {
                  const configs = {
                    T1: {
                      src: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Duval_Triangle_1.png',
                      data: duvalTriangle1, vb: '0 0 1005 1024',
                      calc: d => ({
                        x: (d.pctCH4 / 100) * 500 + (d.pctC2H4 / 100) * 972 + (d.pctC2H2 / 100) * 28,
                        y: (d.pctCH4 / 100) * 55 + (d.pctC2H4 / 100) * 928 + (d.pctC2H2 / 100) * 928
                      })
                    },
                    T4: {
                      src: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Duval_Triangle_4.png',
                      data: duvalTriangle4, vb: '0 0 1005 1024',
                      calc: d => ({
                        x: (d.pctH2 / 100) * 500 + (d.pctCH4 / 100) * 972 + (d.pctC2H6 / 100) * 28,
                        y: (d.pctH2 / 100) * 55 + (d.pctCH4 / 100) * 928 + (d.pctC2H6 / 100) * 928
                      })
                    },
                    T5: {
                      src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Duval_Triangle_5.png',
                      data: duvalTriangle5, vb: '0 0 1005 1024',
                      calc: d => ({
                        x: (d.pctCH4 / 100) * 500 + (d.pctC2H4 / 100) * 972 + (d.pctC2H6 / 100) * 28,
                        y: (d.pctCH4 / 100) * 55 + (d.pctC2H4 / 100) * 928 + (d.pctC2H6 / 100) * 928
                      })
                    },
                    P1: {
                      src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Duval_Pentagram_3.png',
                      data: duvalPentagon1, vb: '0 0 976 822',
                      calc: d => {
                        let cx = 488, cy = 433, r = 224;
                        const ang = [90, 18, -54, -126, 162].map(a => a * Math.PI / 180);
                        const pcts = [d.pctH2, d.pctC2H2, d.pctC2H4, d.pctC2H6, d.pctCH4];
                        let px = cx, py = cy;
                        pcts.forEach((p, i) => {
                          px += (p / 100) * r * 0.85 * Math.cos(ang[i]);
                          py -= (p / 100) * r * 0.85 * Math.sin(ang[i]);
                        });
                        return { x: px, y: py };
                      }
                    }
                  };
                  const c = configs[activeDuvalTab];
                  if (!c.data) {
                    return (
                      <div style={{ padding: '80px', textAlign: 'center', color: '#666', fontSize: '16px' }}>
                        Enter gas values in the Input tab to see analysis
                      </div>
                    );
                  }
                  const pt = c.calc(c.data);
                  const f = FAULT_DESC[c.data.faultZone];
                  return (
                    <div>
                      {/* White background area for triangle image (wiki images have black text) */}
                      <div style={{
                        position: 'relative',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#ffffff',
                        margin: '16px',
                        border: '2px solid #444'
                      }}>
                        <img
                          src={c.src}
                          alt={`Duval ${activeDuvalTab}`}
                          style={{ width: '100%', display: 'block' }}
                        />
                        <svg
                          viewBox={c.vb}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        >
                          <circle cx={pt.x} cy={pt.y} r="24" fill={f?.color} stroke="#fff" strokeWidth="6" />
                          <circle cx={pt.x} cy={pt.y} r="10" fill="#fff" />
                        </svg>
                      </div>
                      {/* Result bar */}
                      <div style={{
                        margin: '0 16px 16px',
                        padding: '16px',
                        background: '#2a2a2a',
                        borderRadius: '12px',
                        borderLeft: '5px solid ' + (f?.color || '#94a3b8')
                      }}>
                        <span style={{
                          padding: '6px 14px', background: f?.color, borderRadius: '6px',
                          fontWeight: '700', color: '#fff', marginRight: '14px', fontSize: '15px'
                        }}>
                          {c.data.faultZone}
                        </span>
                        <span style={{ fontWeight: '600', fontSize: '16px', color: '#e0e0e0' }}>{f?.name}</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {/* Legend */}
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#e0e0e0' }}>Legend</h3>
                {(activeDuvalTab === 'T1' ? ['PD', 'T1', 'T2', 'T3', 'D1', 'D2', 'DT'] :
                  activeDuvalTab === 'T4' ? ['PD', 'S', 'O', 'C'] :
                  activeDuvalTab === 'T5' ? ['PD', 'S', 'O', 'C', 'T2-H', 'T3-H'] :
                  ['PD', 'S', 'O', 'C', 'T1', 'T2-H', 'T3-H', 'D1', 'D2']
                ).map(k => (
                  <div key={k} style={{
                    padding: '12px 14px', background: '#2a2a2a', borderRadius: '8px',
                    borderLeft: '4px solid ' + (FAULT_DESC[k]?.color || '#94a3b8'),
                    marginBottom: '10px', fontSize: '14px', color: '#ccc'
                  }}>
                    <span style={{ fontWeight: '700', color: FAULT_DESC[k]?.color, marginRight: '10px', fontSize: '14px' }}>{k}</span>
                    {FAULT_DESC[k]?.name}
                  </div>
                ))}

                {/* Gas percentages summary */}
                {(() => {
                  const c = { T1: duvalTriangle1, T4: duvalTriangle4, T5: duvalTriangle5, P1: duvalPentagon1 }[activeDuvalTab];
                  if (!c) return null;
                  const entries = activeDuvalTab === 'T1' ? [['CH₄', c.pctCH4], ['C₂H₄', c.pctC2H4], ['C₂H₂', c.pctC2H2]] :
                    activeDuvalTab === 'T4' ? [['H₂', c.pctH2], ['CH₄', c.pctCH4], ['C₂H₆', c.pctC2H6]] :
                    activeDuvalTab === 'T5' ? [['CH₄', c.pctCH4], ['C₂H₄', c.pctC2H4], ['C₂H₆', c.pctC2H6]] :
                    [['H₂', c.pctH2], ['CH₄', c.pctCH4], ['C₂H₆', c.pctC2H6], ['C₂H₄', c.pctC2H4], ['C₂H₂', c.pctC2H2]];
                  return (
                    <div style={{ marginTop: '16px', padding: '14px', background: '#2a2a2a', borderRadius: '10px' }}>
                      <div style={{ fontSize: '13px', color: '#999', marginBottom: '10px', fontWeight: '600' }}>Gas Percentages</div>
                      {entries.map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #333' }}>
                          <span style={{ color: '#ccc', fontSize: '13px' }}>{label}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3b82f6', fontSize: '13px' }}>{val.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* =============== ASSESSMENT TAB =============== */}
        {activeTab === 'assessment' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* IEEE Assessment */}
            <Card style={{ borderLeft: '4px solid ' + STATUS_DESC[dgaStatus].color }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: '#e0e0e0' }}>📋 IEEE C57.104 Assessment</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '16px', background: STATUS_DESC[dgaStatus].bg, borderRadius: '12px', border: `1px solid ${STATUS_DESC[dgaStatus].color}40` }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>Condition</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: STATUS_DESC[dgaStatus].color }}>{ieeeAssessment.condition}</div>
                </div>
                <div style={{ padding: '16px', background: '#2a2a2a', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>Action</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0' }}>{ieeeAssessment.action}</div>
                </div>
                <div style={{ padding: '16px', background: '#2a2a2a', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>Interval</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0' }}>{ieeeAssessment.interval}</div>
                </div>
              </div>

              <div style={{ padding: '16px', background: '#2a2a2a', borderRadius: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#ccc' }}>Recommendations</div>
                {ieeeAssessment.recommendations.map((r, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#1a1a1a', borderRadius: '8px', marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>
                    • {r}
                  </div>
                ))}
              </div>
            </Card>

            {/* Rogers + CO2/CO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#e0e0e0' }}>📐 Rogers Ratios</h3>
                {rogersRatios ? (
                  <div>
                    {[['R1 (C₂H₂/C₂H₄)', rogersRatios.r1], ['R2 (CH₄/H₂)', rogersRatios.r2], ['R3 (C₂H₄/C₂H₆)', rogersRatios.r3]].map(([l, v]) => (
                      <div key={l} style={{ padding: '12px', background: '#2a2a2a', borderRadius: '10px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>{l}</div>
                        <div style={{ fontSize: '22px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>{v.toFixed(4)}</div>
                      </div>
                    ))}
                    <div style={{ padding: '14px', background: '#3b82f615', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>Diagnosis</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#e0e0e0' }}>{rogersRatios.diagnosis}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '50px', textAlign: 'center', color: '#666', fontSize: '14px' }}>Enter values to calculate</div>
                )}
              </Card>
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#e0e0e0' }}>📊 CO₂/CO Ratio</h3>
                {co2coRatio ? (
                  <div>
                    <div style={{ padding: '12px', background: '#2a2a2a', borderRadius: '10px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Ratio</div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>{co2coRatio.ratio.toFixed(2)}</div>
                    </div>
                    <div style={{
                      padding: '14px', borderRadius: '10px',
                      background: co2coRatio.severity === 'warning' ? '#ef444420' : '#22c55e20',
                      border: `1px solid ${co2coRatio.severity === 'warning' ? '#ef444440' : '#22c55e40'}`
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: co2coRatio.severity === 'warning' ? '#ef4444' : '#22c55e' }}>
                        {co2coRatio.interpretation}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '50px', textAlign: 'center', color: '#666', fontSize: '14px' }}>Enter CO/CO₂ values</div>
                )}
              </Card>
            </div>

            {/* AI Interpretation */}
            <Card style={{ background: '#1a1a2e', border: '1px solid #3b82f630' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🤖 AI Interpretation</span>
              </h3>
              <div style={{ padding: '16px', background: '#0a0a0a', borderRadius: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#ccc' }}>
                  {(() => {
                    const insights = [];
                    if (dgaStatus === 1) insights.push('✅ The transformer is operating within normal parameters according to IEEE C57.104-2019 standards.');
                    else if (dgaStatus === 2) insights.push('⚠️ Elevated gas levels detected. The transformer requires increased monitoring frequency.');
                    else insights.push('🚨 Warning condition detected. Immediate investigation and engineering review recommended.');

                    if (duvalTriangle1) {
                      const fi = FAULT_DESC[duvalTriangle1.faultZone];
                      if (fi) insights.push(`🔺 Duval Triangle 1 indicates "${fi.name}" fault type.`);
                    }
                    if (co2coRatio) {
                      if (co2coRatio.ratio < 3) insights.push('📊 Low CO₂/CO ratio suggests possible thermal degradation of cellulose insulation.');
                      else if (co2coRatio.ratio > 10) insights.push('📊 CO₂/CO ratio indicates normal cellulose aging without significant thermal stress.');
                    }
                    if (rogersRatios) insights.push(`📐 Rogers Ratio analysis suggests: ${rogersRatios.diagnosis}.`);
                    if (transformerAge !== null) {
                      if (transformerAge < 10) insights.push(`📅 As a relatively new transformer (${transformerAge} years), stricter gas limits are applied.`);
                      else if (transformerAge >= 30) insights.push(`📅 This is an aged transformer (${transformerAge} years). More lenient limits are applied, but closer monitoring is advised.`);
                    }
                    insights.push(o2n2Ratio <= 0.2
                      ? '🔒 O₂/N₂ ratio indicates a sealed/conservator type transformer.'
                      : '🌬️ O₂/N₂ ratio indicates a breathing type transformer.'
                    );

                    return insights.map((ins, i) => (
                      <div key={i} style={{ marginBottom: i < insights.length - 1 ? '10px' : '0', padding: '10px 12px', background: '#1a1a1a', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                        {ins}
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: '#92400e20', borderRadius: '8px', fontSize: '13px', color: '#fbbf24', display: 'flex', alignItems: 'flex-start', gap: '8px', border: '1px solid #92400e40' }}>
                <span>💡</span>
                <span>This AI interpretation is based on IEEE C57.104-2019, Duval Triangle, and Rogers Ratio methods. Always consult qualified engineers for critical decisions.</span>
              </div>
            </Card>

            {/* Gas Analysis alerts */}
            {gasAnalysis.length > 0 && (
              <Card>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#e0e0e0' }}>🔬 Gas Analysis</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {gasAnalysis.map((a, i) => (
                    <div key={i} style={{ padding: '14px', background: '#2a2a2a', borderRadius: '12px', borderLeft: '4px solid ' + a.color }}>
                      <span style={{ padding: '4px 12px', background: a.color, borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '700', marginRight: '10px' }}>
                        {a.gas}
                      </span>
                      <span style={{ fontWeight: '600', color: a.color, fontSize: '14px' }}>{a.level}</span>
                      <div style={{ fontSize: '14px', color: '#999', marginTop: '6px' }}>{a.message}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #333', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#666' }}>
          DGA Analysis Tool — Based on IEEE C57.104-2019 | Developed by{' '}
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>CHM. Ts. Hadi Fauzi, MRSC</span>
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
          ⚠️ For reference only — consult qualified Chemist and Engineers for critical decisions
        </div>
      </div>
    </div>
  );
}
