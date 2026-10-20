import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { GasValues, TransformerInfo, DGARecord, TransformerListItem, FilterState } from '../types';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '32px', ...style }}>
    {children}
  </div>
);

export default function DGAToolsV2() {
  const [gasValues, setGasValues] = useState<GasValues>({ H2: '', CH4: '', C2H6: '', C2H4: '', C2H2: '', CO: '', CO2: '', O2: '', N2: '' });
  const [transformerInfo, setTransformerInfo] = useState<TransformerInfo>({ siteLocation: '', samplingPoint: 'Main Tank', mnemonic: '', serialNumber: '', manufacturer: '', voltage: '', mvaRating: '', yearBuilt: '', sampleDate: new Date().toISOString().split('T')[0], oilTemperature: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeDuvalTab, setActiveDuvalTab] = useState('T1');
  const [savedRecords, setSavedRecords] = useState<DGARecord[]>(() => {
    try {
      const stored = localStorage.getItem('dgaRecords');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [dbFilter, setDbFilter] = useState<FilterState>({ samplingPoint: 'All', status: 'All', site: 'All' });
  const [selectedTransformer, setSelectedTransformer] = useState<TransformerListItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to localStorage whenever savedRecords changes
  useEffect(() => {
    try {
      localStorage.setItem('dgaRecords', JSON.stringify(savedRecords));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }, [savedRecords]);

  const parseGas = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
  const o2n2Ratio = useMemo(() => { const o2 = parseGas(gasValues.O2), n2 = parseGas(gasValues.N2); return n2 === 0 ? 0 : o2 / n2; }, [gasValues.O2, gasValues.N2]);
  const tdcg = useMemo(() => parseGas(gasValues.H2) + parseGas(gasValues.CH4) + parseGas(gasValues.C2H6) + parseGas(gasValues.C2H4) + parseGas(gasValues.C2H2) + parseGas(gasValues.CO), [gasValues]);

  // Calculate transformer age
  const transformerAge = useMemo(() => {
    if (!transformerInfo.yearBuilt) return null;
    const year = parseInt(transformerInfo.yearBuilt);
    return isNaN(year) ? null : new Date().getFullYear() - year;
  }, [transformerInfo.yearBuilt]);

  // Age-based limits (IEEE C57.104-2019)
  const getAgeLimits = (age: number | null, o2n2: number) => {
    // When O2/N2 <= 0.2 (sealed transformer), use age-specific limits
    if (o2n2 <= 0.2) {
      if (age === null || age < 1) {
        // Default for unknown age
        return {
          table1: { H2: 100, CH4: 90, C2H6: 90, C2H4: 50, C2H2: 2, CO: 350, CO2: 2500 },
          table2: { H2: 200, CH4: 180, C2H6: 180, C2H4: 100, C2H2: 4, CO: 570, CO2: 4000 }
        };
      } else if (age >= 1 && age < 10) {
        // New transformers (1-9 years) - strictest limits
        return {
          table1: { H2: 75, CH4: 45, C2H6: 30, C2H4: 20, C2H2: 1, CO: 350, CO2: 2500 },
          table2: { H2: 150, CH4: 90, C2H6: 60, C2H4: 40, C2H2: 2, CO: 570, CO2: 4000 }
        };
      } else if (age >= 10 && age < 30) {
        // Medium age transformers (10-30 years)
        return {
          table1: { H2: 100, CH4: 90, C2H6: 90, C2H4: 50, C2H2: 2, CO: 500, CO2: 3500 },
          table2: { H2: 200, CH4: 180, C2H6: 180, C2H4: 100, C2H2: 4, CO: 800, CO2: 5500 }
        };
      } else {
        // Old transformers (>30 years) - most lenient
        return {
          table1: { H2: 999999, CH4: 110, C2H6: 150, C2H4: 90, C2H2: 2, CO: 700, CO2: 4500 },
          table2: { H2: 999999, CH4: 220, C2H6: 300, C2H4: 180, C2H2: 4, CO: 1000, CO2: 7000 }
        };
      }
    } else {
      // When O2/N2 > 0.2 (breathing transformer), use standard IEEE limits (age-independent)
      return {
        table1: { H2: 100, CH4: 120, C2H6: 65, C2H4: 50, C2H2: 1, CO: 500, CO2: 5000 },
        table2: { H2: 200, CH4: 240, C2H6: 130, C2H4: 100, C2H2: 2, CO: 800, CO2: 7500 }
      };
    }
  };

  const ageLimits = useMemo(() => getAgeLimits(transformerAge, o2n2Ratio), [transformerAge, o2n2Ratio]);
  const table1Norms = ageLimits.table1;
  const table2Norms = ageLimits.table2;

  const calcStatus = (gv: GasValues, age: number | null = null, o2n2: number = 0): number => {
    const limits = getAgeLimits(age, o2n2);
    let s2 = false, s1 = false;
    const t = parseGas(gv.H2) + parseGas(gv.CH4) + parseGas(gv.C2H6) + parseGas(gv.C2H4) + parseGas(gv.C2H2) + parseGas(gv.CO);
    ['H2','CH4','C2H6','C2H4','C2H2','CO','CO2'].forEach(g => { const v = parseGas(gv[g]); if (v > limits.table2[g]) s2 = true; if (v > limits.table1[g]) s1 = true; });
    if (t > 1920) return 3; if (t > 720) return s2 ? 3 : 2; return s2 ? 3 : s1 ? 2 : 1;
  };

  const dgaStatus = useMemo(() => calcStatus(gasValues, transformerAge, o2n2Ratio), [gasValues, transformerAge, o2n2Ratio]);

  const calcDuval1 = (gv: GasValues) => {
    const ch4 = parseGas(gv.CH4), c2h4 = parseGas(gv.C2H4), c2h2 = parseGas(gv.C2H2), total = ch4 + c2h4 + c2h2;
    if (total === 0) return null;
    const pctCH4 = (ch4/total)*100, pctC2H4 = (c2h4/total)*100, pctC2H2 = (c2h2/total)*100;
    let faultZone = 'T1';
    if (pctCH4 >= 98) faultZone = 'PD'; 
    else if (pctC2H4 >= 50 && pctC2H2 < 15) faultZone = 'T3';
    else if (pctC2H2 >= 13) {
      if (pctC2H4 < 23) faultZone = 'D1';
      else faultZone = 'D2';
    }
    else if (pctC2H2 >= 4) faultZone = 'DT';
    else if (pctC2H4 >= 20) faultZone = 'T2';
    return { pctCH4, pctC2H4, pctC2H2, faultZone };
  };

  const duvalTriangle1 = useMemo(() => calcDuval1(gasValues), [gasValues]);
  const duvalTriangle4 = useMemo(() => { 
    const h2 = parseGas(gasValues.H2), ch4 = parseGas(gasValues.CH4), c2h6 = parseGas(gasValues.C2H6), total = h2 + ch4 + c2h6; 
    if (total === 0) return null; 
    const pctH2 = (h2/total)*100, pctCH4 = (ch4/total)*100, pctC2H6 = (c2h6/total)*100; 
    let faultZone = 'S'; // Default to Stray Gassing
    if (pctH2 >= 90) faultZone = 'PD'; 
    else if (pctCH4 >= 64) faultZone = 'C'; // Carbonization zone
    else if (pctC2H6 >= 52) faultZone = 'O'; // Overheating zone (bottom left)
    return { pctH2, pctCH4, pctC2H6, faultZone }; 
  }, [gasValues]);
  const duvalTriangle5 = useMemo(() => { const ch4 = parseGas(gasValues.CH4), c2h4 = parseGas(gasValues.C2H4), c2h6 = parseGas(gasValues.C2H6), total = ch4 + c2h4 + c2h6; if (total === 0) return null; const pctCH4 = (ch4/total)*100, pctC2H4 = (c2h4/total)*100, pctC2H6 = (c2h6/total)*100; let faultZone = 'ND'; if (pctCH4 >= 98) faultZone = 'PD'; else if (pctC2H4 >= 50) faultZone = 'T3-H'; else if (pctCH4 >= 35 && pctCH4 <= 75 && pctC2H4 >= 10 && pctC2H4 < 40) faultZone = 'C'; else if (pctC2H4 >= 20) faultZone = 'T2-H'; else if (pctC2H6 >= 50) faultZone = 'S'; else if (pctCH4 >= 40) faultZone = 'O'; return { pctCH4, pctC2H4, pctC2H6, faultZone }; }, [gasValues]);
  const duvalPentagon1 = useMemo(() => { const h2 = parseGas(gasValues.H2), ch4 = parseGas(gasValues.CH4), c2h6 = parseGas(gasValues.C2H6), c2h4 = parseGas(gasValues.C2H4), c2h2 = parseGas(gasValues.C2H2), total = h2+ch4+c2h6+c2h4+c2h2; if (total === 0) return null; const pctH2 = (h2/total)*100, pctCH4 = (ch4/total)*100, pctC2H6 = (c2h6/total)*100, pctC2H4 = (c2h4/total)*100, pctC2H2 = (c2h2/total)*100; let faultZone = 'S'; if (pctH2 > 85) faultZone = 'PD'; else if (pctC2H2 > 20) faultZone = pctC2H4 > 20 ? 'D2' : 'D1'; else if (pctC2H4 > 50) faultZone = 'T3-H'; else if (pctCH4 > 45 && pctC2H4 >= 10 && pctC2H4 < 30) faultZone = 'C'; else if (pctC2H4 > 20) faultZone = 'T2-H'; else if (pctC2H6 > 35 && pctCH4 < 50) faultZone = 'O'; else if (pctCH4 > 50) faultZone = 'T1'; return { pctH2, pctCH4, pctC2H6, pctC2H4, pctC2H2, faultZone }; }, [gasValues]);

  const rogersRatios = useMemo(() => { const ch4 = parseGas(gasValues.CH4), h2 = parseGas(gasValues.H2), c2h4 = parseGas(gasValues.C2H4), c2h6 = parseGas(gasValues.C2H6), c2h2 = parseGas(gasValues.C2H2); if (h2 === 0 || c2h4 === 0 || c2h6 === 0) return null; const r1 = c2h2/c2h4, r2 = ch4/h2, r3 = c2h4/c2h6; let diagnosis = 'Undetermined'; if (r1 < 0.1 && r2 >= 0.1 && r2 <= 1.0 && r3 < 1.0) diagnosis = 'Normal Aging'; else if (r1 < 0.1 && r2 < 0.1) diagnosis = 'Partial Discharge'; else if (r1 >= 0.1 && r1 <= 3.0 && r3 > 3.0) diagnosis = 'Arcing Fault'; else if (r1 < 0.1 && r2 > 1.0 && r3 <= 3.0) diagnosis = 'Thermal < 700°C'; else if (r1 < 0.1 && r2 > 1.0 && r3 > 3.0) diagnosis = 'Thermal > 700°C'; return { r1, r2, r3, diagnosis }; }, [gasValues]);
  const co2coRatio = useMemo(() => { const co = parseGas(gasValues.CO), co2 = parseGas(gasValues.CO2); if (co === 0) return null; const ratio = co2/co; let interpretation = 'Normal'; let severity: 'normal' | 'warning' = 'normal'; if (ratio < 3) { interpretation = 'Thermal fault in cellulose'; severity = 'warning'; } return { ratio, interpretation, severity }; }, [gasValues]);

  const gasAnalysis = useMemo(() => { const analysis: any[] = [], msgs: Record<string, string> = { H2: 'Hydrogen - partial discharge or overheating', CH4: 'Methane - low-temp decomposition', C2H6: 'Ethane - thermal 200-400°C', C2H4: 'Ethylene - high-temp fault', C2H2: 'Acetylene - CRITICAL: arcing!', CO: 'CO - cellulose degradation' }; (['H2','CH4','C2H6','C2H4','C2H2','CO'] as const).forEach(g => { const v = parseGas(gasValues[g]); if (v > table1Norms[g]) analysis.push({ gas: g, level: v > table2Norms[g] ? 'High' : 'Elevated', message: msgs[g], color: v > table2Norms[g] ? '#ef4444' : '#f59e0b' }); }); return analysis; }, [gasValues]);
  const ieeeAssessment = useMemo(() => { const fault = duvalTriangle1?.faultZone; let condition: string, action: string, interval: string, recommendations: string[] = []; if (dgaStatus === 1) { condition = 'Normal'; action = 'Continue operation'; interval = 'Annual'; recommendations = ['Maintain routine schedule']; } else if (dgaStatus === 2) { condition = 'Caution'; action = 'Increase monitoring'; interval = 'Quarterly'; recommendations = ['Increase sampling frequency', 'Review history']; } else { condition = 'Warning'; action = 'Investigation required'; interval = 'Monthly'; recommendations = ['Engineering review', 'Consider load reduction', 'Inspection needed']; } if (fault === 'D1' || fault === 'D2') recommendations.push('Check connections'); if (fault === 'T3') recommendations.push('Inspect for hot spots'); if (fault === 'PD') recommendations.push('Check insulation'); return { condition, action, interval, recommendations }; }, [dgaStatus, duvalTriangle1]);

  const faultDesc: Record<string, { name: string; color: string }> = { 'PD': { name: 'Partial Discharge', color: '#3b82f6' }, 'T1': { name: 'Thermal < 300°C', color: '#22c55e' }, 'T2': { name: 'Thermal 300-700°C', color: '#eab308' }, 'T3': { name: 'Thermal > 700°C', color: '#f97316' }, 'T2-H': { name: 'Thermal 300-700°C', color: '#eab308' }, 'T3-H': { name: 'Thermal > 700°C', color: '#f97316' }, 'D1': { name: 'Low Energy Discharge', color: '#ef4444' }, 'D2': { name: 'High Energy Discharge', color: '#dc2626' }, 'DT': { name: 'Mixed Fault', color: '#8b5cf6' }, 'S': { name: 'Stray Gassing', color: '#06b6d4' }, 'O': { name: 'Overheating', color: '#84cc16' }, 'C': { name: 'Carbonization', color: '#f59e0b' }, 'ND': { name: 'Not Determined', color: '#94a3b8' } };
  const statusDesc: Record<number, { name: string; color: string; bg: string }> = { 1: { name: 'Normal', color: '#22c55e', bg: '#dcfce7' }, 2: { name: 'Caution', color: '#f59e0b', bg: '#fef3c7' }, 3: { name: 'Warning', color: '#ef4444', bg: '#fee2e2' } };
  const gasColors: Record<string, string> = { H2: '#3b82f6', CH4: '#22c55e', C2H6: '#f59e0b', C2H4: '#ef4444', C2H2: '#8b5cf6', CO: '#06b6d4', CO2: '#ec4899' };
  const gasNames: Record<string, string> = { H2: 'Hydrogen', CH4: 'Methane', C2H6: 'Ethane', C2H4: 'Ethylene', C2H2: 'Acetylene', CO: 'Carbon Monoxide', CO2: 'Carbon Dioxide', O2: 'Oxygen', N2: 'Nitrogen' };

  const transformerList = useMemo(() => { const map: Record<string, any> = {}; savedRecords.forEach(r => { const key = r.transformer.serialNumber || r.transformer.mnemonic || 'Unknown'; if (!map[key]) map[key] = { info: r.transformer, records: [], latestStatus: 1 }; map[key].records.push(r); if (r.analysis.dgaStatus > map[key].latestStatus) map[key].latestStatus = r.analysis.dgaStatus; }); return Object.entries(map).map(([k, v]) => ({ id: k, ...v, records: v.records.sort((a: any, b: any) => new Date(b.transformer.sampleDate).getTime() - new Date(a.transformer.sampleDate).getTime()) })); }, [savedRecords]);
  const uniqueSites = useMemo(() => ['All', ...new Set(savedRecords.map(r => r.transformer.siteLocation).filter(Boolean))], [savedRecords]);
  const filteredTransformers = useMemo(() => transformerList.filter(t => { const matchSearch = !dbSearch || t.id.toLowerCase().includes(dbSearch.toLowerCase()) || (t.info.siteLocation || '').toLowerCase().includes(dbSearch.toLowerCase()); const matchPoint = dbFilter.samplingPoint === 'All' || t.info.samplingPoint === dbFilter.samplingPoint; const matchStatus = dbFilter.status === 'All' || t.latestStatus === parseInt(dbFilter.status); const matchSite = dbFilter.site === 'All' || t.info.siteLocation === dbFilter.site; return matchSearch && matchPoint && matchStatus && matchSite; }), [transformerList, dbSearch, dbFilter]);

  const calcSimilarity = (gv1: GasValues, gv2: GasValues): number => { const gases = ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO'] as const; let totalDiff = 0, count = 0; gases.forEach(g => { const v1 = parseGas(gv1[g]), v2 = parseGas(gv2[g]); if (v1 > 0 || v2 > 0) { const max = Math.max(v1, v2, 1); totalDiff += Math.abs(v1 - v2) / max; count++; } }); if (count === 0) return 0; return Math.max(0, Math.round((1 - totalDiff / count) * 100)); };
  const similarPatterns = useMemo(() => { if (!duvalTriangle1) return []; const currentFault = duvalTriangle1.faultZone, matches: any[] = []; savedRecords.forEach(r => { const rDuval = calcDuval1(r.gasValues); if (rDuval && rDuval.faultZone === currentFault) { const similarity = calcSimilarity(gasValues, r.gasValues); if (similarity >= 50) matches.push({ record: r, similarity, fault: rDuval.faultZone }); } }); return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5); }, [gasValues, savedRecords, duvalTriangle1]);

  const handleGasChange = useCallback((g: keyof GasValues, v: string) => setGasValues(p => ({ ...p, [g]: v })), []);
  const handleInfoChange = useCallback((f: keyof TransformerInfo, v: string) => setTransformerInfo(p => ({ ...p, [f]: v })), []);
  const saveRecord = () => { 
    const rec: DGARecord = { 
      id: Date.now(), 
      transformer: transformerInfo, 
      gasValues, 
      analysis: { dgaStatus, tdcg, duvalT1: duvalTriangle1, rogers: rogersRatios, co2co: co2coRatio }, 
      createdAt: new Date().toISOString() 
    }; 
    setSavedRecords(p => [rec, ...p]); 
    
    // Clear the form after saving
    setGasValues({ H2:'',CH4:'',C2H6:'',C2H4:'',C2H2:'',CO:'',CO2:'',O2:'',N2:'' });
    setTransformerInfo({ 
      siteLocation: '', 
      samplingPoint: 'Main Tank', 
      mnemonic: '', 
      serialNumber: '', 
      manufacturer: '', 
      voltage: '', 
      mvaRating: '', 
      yearBuilt: '', 
      sampleDate: new Date().toISOString().split('T')[0], 
      oilTemperature: '' 
    });
    
    // Switch to database tab to show the saved record
    setActiveTab('database');
    
    alert('Record saved successfully!'); 
  };
  
  const exportJSON = async () => { 
    const data = { version: '4.0', exportedAt: new Date().toISOString(), records: savedRecords };
    const jsonString = JSON.stringify(data, null, 2);
    
    // Use Electron's native save dialog if available
    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile(jsonString, 'dga_database.json');
      if (result.success) {
        alert('Database exported successfully!');
      }
    } else {
      // Fallback for browser
      const blob = new Blob([jsonString], { type: 'application/json' }); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = 'dga_database.json'; 
      a.click(); 
      URL.revokeObjectURL(url);
    }
  };
  
  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (data.records) { setSavedRecords(p => [...data.records, ...p]); alert('Imported ' + data.records.length + ' records!'); } } catch (err) { alert('Invalid JSON'); } }; reader.readAsText(file); };
  
  const importJSONElectron = async () => {
    // Use Electron's native open dialog if available
    if (window.electronAPI) {
      const result = await window.electronAPI.openFile();
      if (result.success && result.content) {
        try {
          const data = JSON.parse(result.content);
          if (data.records) {
            setSavedRecords(p => [...data.records, ...p]);
            alert('Imported ' + data.records.length + ' records successfully!');
          }
        } catch (err) {
          alert('Invalid JSON file');
        }
      }
    } else {
      // Fallback for browser
      fileInputRef.current?.click();
    }
  };
  const loadDemo = () => { const demo: DGARecord[] = []; const txs = [{ sn: 'TX-001', mn: 'XFMR-A1', site: 'Substation Alpha', mva: '100', v: '132' }, { sn: 'TX-002', mn: 'XFMR-B1', site: 'Substation Beta', mva: '50', v: '33' }, { sn: 'TX-003', mn: 'XFMR-P1', site: 'Plant Main', mva: '150', v: '275' }]; txs.forEach((tx, ti) => { (['2024-01', '2024-04', '2024-07', '2024-10'] as const).forEach((d, di) => { const m = ti === 2 ? 2 : 1; const gv: GasValues = { H2: String(30+di*20*m), CH4: String(20+di*15*m), C2H6: String(15+di*10), C2H4: String(10+di*12*m), C2H2: String((0.3+di*0.8*m).toFixed(1)), CO: String(300+di*50), CO2: String(2800+di*300), O2: '5000', N2: '50000' }; demo.push({ id: Date.now()+ti*100+di, transformer: { serialNumber: tx.sn, mnemonic: tx.mn, siteLocation: tx.site, mvaRating: tx.mva, voltage: tx.v, sampleDate: d, samplingPoint: 'Main Tank', manufacturer: '', yearBuilt: '', oilTemperature: '' }, gasValues: gv, analysis: { dgaStatus: calcStatus(gv), tdcg: parseGas(gv.H2)+parseGas(gv.CH4)+parseGas(gv.C2H6)+parseGas(gv.C2H4)+parseGas(gv.C2H2)+parseGas(gv.CO), duvalT1: calcDuval1(gv), rogers: null, co2co: null }, createdAt: new Date().toISOString() }); }); }); setSavedRecords(demo); };

  const selectedTxTrend = useMemo(() => { if (!selectedTransformer) return []; return selectedTransformer.records.slice().reverse().map(r => ({ date: r.transformer.sampleDate, H2: parseFloat(r.gasValues.H2)||0, CH4: parseFloat(r.gasValues.CH4)||0, C2H4: parseFloat(r.gasValues.C2H4)||0, C2H2: parseFloat(r.gasValues.C2H2)||0, TDCG: r.analysis.tdcg||0 })); }, [selectedTransformer]);

  const tabs = [{ id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'input', label: 'Input', icon: '📝' }, { id: 'duval', label: 'Duval', icon: '🔺' }, { id: 'assessment', label: 'Assessment', icon: '📋' }, { id: 'database', label: 'Database', icon: '🗄️' }, { id: 'records', label: 'Records', icon: '📁' }];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 32px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div><h1 style={{ fontSize: '32px', fontWeight: '700', margin: 0, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DGA Analyzer Pro</h1><p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>IEEE C57.104-2019</p></div>
          <div style={{ display: 'flex', gap: '12px' }}><input type="file" ref={fileInputRef} onChange={importJSON} accept=".json" style={{ display: 'none' }} /><button onClick={importJSONElectron} style={{ padding: '12px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}>📥 Import</button><button onClick={exportJSON} disabled={!savedRecords.length} style={{ padding: '12px 20px', background: savedRecords.length ? '#3b82f6' : '#e2e8f0', border: 'none', borderRadius: '10px', color: savedRecords.length ? '#fff' : '#94a3b8', fontSize: '16px', cursor: 'pointer' }}>📤 Export</button></div>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0 32px' }}>
          {tabs.map(t => <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id !== 'database') setSelectedTransformer(null); }} style={{ padding: '16px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === t.id ? '#3b82f6' : '#64748b', fontSize: '16px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.icon} {t.label}</button>)}
        </div>
      </div>

      <div style={{ padding: '32px' }}>

        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {[{ title: 'Status', value: 'S' + dgaStatus, sub: statusDesc[dgaStatus].name, color: statusDesc[dgaStatus].color }, { title: 'TDCG', value: tdcg, sub: 'ppm', color: tdcg > 720 ? '#f59e0b' : '#22c55e' }, { title: 'Transformers', value: transformerList.length, sub: 'in DB', color: '#3b82f6' }, { title: 'Records', value: savedRecords.length, sub: 'total', color: '#8b5cf6' }, { title: 'Fault', value: duvalTriangle1?.faultZone || '—', sub: duvalTriangle1 ? faultDesc[duvalTriangle1.faultZone]?.name : '—', color: duvalTriangle1 ? faultDesc[duvalTriangle1.faultZone]?.color : '#94a3b8' }].map((s, i) => <Card key={i} style={{ background: s.color + '10', border: '2px solid ' + s.color + '30', padding: '24px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>{s.title}</div><div style={{ fontSize: '36px', fontWeight: '700', color: s.color, marginBottom: '4px' }}>{s.value}</div><div style={{ fontSize: '14px', color: '#94a3b8' }}>{s.sub}</div></Card>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Gas Levels</h3><ResponsiveContainer width="100%" height={240}><BarChart data={['H2','CH4','C2H6','C2H4','C2H2'].map(g => ({ name: g, value: parseGas(gasValues[g]), limit: table1Norms[g] }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" stroke="#94a3b8" fontSize={14} /><YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={14} width={50} /><Tooltip contentStyle={{ fontSize: '14px' }} /><Bar dataKey="value" fill="#3b82f6" radius={[0,6,6,0]} /><Bar dataKey="limit" fill="#e2e8f0" radius={[0,6,6,0]} /></BarChart></ResponsiveContainer></Card>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Similar Patterns</h3>{similarPatterns.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '16px' }}>No matches found</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{similarPatterns.map((m, i) => <div key={i} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid ' + faultDesc[m.fault]?.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: '600', fontSize: '16px' }}>{m.record.transformer.mnemonic || m.record.transformer.serialNumber}</div><div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>{m.record.transformer.sampleDate}</div></div><div style={{ padding: '8px 16px', background: m.similarity >= 80 ? '#dcfce7' : m.similarity >= 60 ? '#fef3c7' : '#fee2e2', borderRadius: '8px', fontWeight: '700', fontSize: '18px', color: m.similarity >= 80 ? '#16a34a' : m.similarity >= 60 ? '#d97706' : '#dc2626' }}>{m.similarity}%</div></div>)}</div>}</Card>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>🏭 Transformer Info</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>{[['Site','siteLocation'],['Serial No.','serialNumber'],['Mnemonic','mnemonic'],['MVA','mvaRating'],['Voltage','voltage'],['Year Built','yearBuilt'],['Date','sampleDate','date'],['Point','samplingPoint']].map(([l,f,t]) => <div key={f}><label style={{ fontSize: '14px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '500' }}>{l}</label>{f === 'samplingPoint' ? <select value={transformerInfo[f as keyof TransformerInfo]} onChange={e => handleInfoChange(f as keyof TransformerInfo, e.target.value)} style={{ width: '100%', padding: '14px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px' }}><option>Main Tank</option><option>OLTC</option><option>Bushing</option></select> : <input type={t||'text'} value={transformerInfo[f as keyof TransformerInfo]} onChange={e => handleInfoChange(f as keyof TransformerInfo, e.target.value)} style={{ width: '100%', padding: '14px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box' }} placeholder={f === 'yearBuilt' ? 'e.g., 2021' : ''} />}</div>)}</div></Card>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>🧪 Gas Values (ppm)</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>{(['H2','CH4','C2H6','C2H4','C2H2','CO','CO2','O2','N2'] as const).map(g => <div key={g} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: gasColors[g] || '#94a3b8' }}></div><span style={{ fontSize: '15px', fontWeight: '600' }}>{g}</span></div><div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{gasNames[g]}</div><input type="number" value={gasValues[g]} onChange={e => handleGasChange(g, e.target.value)} placeholder="0" style={{ width: '100%', padding: '12px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '18px', fontFamily: 'monospace', boxSizing: 'border-box' }} /></div>)}</div><div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}><div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>O₂/N₂</div><div style={{ fontSize: '24px', fontWeight: '600', color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>{o2n2Ratio.toFixed(4)}</div></div><div style={{ padding: '16px', background: o2n2Ratio <= 0.2 ? '#dcfce7' : '#fef3c7', borderRadius: '12px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>Type</div><div style={{ fontSize: '18px', fontWeight: '600', color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>{o2n2Ratio <= 0.2 ? 'Sealed' : 'Breathing'}</div></div><div style={{ padding: '16px', background: tdcg > 720 ? '#fef3c7' : '#dcfce7', borderRadius: '12px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>TDCG</div><div style={{ fontSize: '24px', fontWeight: '600', color: tdcg > 720 ? '#f59e0b' : '#22c55e' }}>{tdcg} ppm</div></div></div><div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}><button onClick={() => { setShowAnalysis(true); setActiveTab('assessment'); }} style={{ flex: 1, padding: '16px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>🔍 Analyze</button><button onClick={saveRecord} style={{ flex: 1, padding: '16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>💾 Save</button><button onClick={() => setGasValues({ H2:'',CH4:'',C2H6:'',C2H4:'',C2H2:'',CO:'',CO2:'',O2:'',N2:'' })} style={{ padding: '16px 20px', background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontSize: '16px', cursor: 'pointer' }}>Clear</button></div></Card>
            </div>
          </div>
        )}

        {activeTab === 'duval' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>{[['T1','Triangle 1'],['T4','Triangle 4'],['T5','Triangle 5'],['P1','Pentagon']].map(([id,l]) => <button key={id} onClick={() => setActiveDuvalTab(id)} style={{ padding: '16px 28px', background: activeDuvalTab === id ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#fff', border: activeDuvalTab === id ? 'none' : '2px solid #e2e8f0', borderRadius: '12px', color: activeDuvalTab === id ? '#fff' : '#64748b', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>{l}</button>)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <Card>{(() => { const configs = { T1: { src: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Duval_Triangle_1.png', data: duvalTriangle1, vb: '0 0 1005 1024', calc: d => ({ x: (d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H2/100)*28, y: (d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H2/100)*928 }) }, T4: { src: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Duval_Triangle_4.png', data: duvalTriangle4, vb: '0 0 1005 1024', calc: d => ({ x: (d.pctH2/100)*500+(d.pctCH4/100)*972+(d.pctC2H6/100)*28, y: (d.pctH2/100)*55+(d.pctCH4/100)*928+(d.pctC2H6/100)*928 }) }, T5: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Duval_Triangle_5.png', data: duvalTriangle5, vb: '0 0 1005 1024', calc: d => ({ x: (d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H6/100)*28, y: (d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H6/100)*928 }) }, P1: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Duval_Pentagram_3.png', data: duvalPentagon1, vb: '0 0 976 822', calc: d => { let cx=488,cy=433,r=224,ang=[90,18,-54,-126,162].map(a=>a*Math.PI/180),pcts=[d.pctH2,d.pctC2H2,d.pctC2H4,d.pctC2H6,d.pctCH4],px=cx,py=cy; pcts.forEach((p,i)=>{px+=(p/100)*r*0.85*Math.cos(ang[i]);py-=(p/100)*r*0.85*Math.sin(ang[i]);}); return {x:px,y:py}; } } }; const c = configs[activeDuvalTab]; if (!c.data) return <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '18px' }}>Enter gas values</div>; const pt = c.calc(c.data), f = faultDesc[c.data.faultZone]; return <div><div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0' }}><img src={c.src} alt="" style={{ width: '100%', display: 'block' }} /><svg viewBox={c.vb} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><circle cx={pt.x} cy={pt.y} r="24" fill={f?.color} stroke="#fff" strokeWidth="6" /><circle cx={pt.x} cy={pt.y} r="10" fill="#fff" /></svg></div><div style={{ marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '14px', borderLeft: '5px solid '+(f?.color||'#94a3b8') }}><span style={{ padding: '8px 16px', background: f?.color, borderRadius: '8px', fontWeight: '700', color: '#fff', marginRight: '16px', fontSize: '16px' }}>{c.data.faultZone}</span><span style={{ fontWeight: '600', fontSize: '18px' }}>{f?.name}</span></div></div>; })()}</Card>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Legend</h3>{(activeDuvalTab === 'T1' ? ['PD','T1','T2','T3','D1','D2','DT'] : activeDuvalTab === 'T4' ? ['PD','S','O','C'] : activeDuvalTab === 'T5' ? ['PD','S','O','C','T2-H','T3-H'] : ['PD','S','O','C','T1','T2-H','T3-H','D1','D2']).map(k => <div key={k} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', borderLeft: '4px solid '+(faultDesc[k]?.color||'#94a3b8'), marginBottom: '12px', fontSize: '15px' }}><span style={{ fontWeight: '700', color: faultDesc[k]?.color, marginRight: '12px', fontSize: '16px' }}>{k}</span>{faultDesc[k]?.name}</div>)}</Card>
            </div>
          </div>
        )}

        {activeTab === 'assessment' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <Card style={{ borderLeft: '5px solid '+statusDesc[dgaStatus].color }}><h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>📋 IEEE C57.104 Assessment</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}><div style={{ padding: '20px', background: statusDesc[dgaStatus].bg, borderRadius: '14px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Condition</div><div style={{ fontSize: '24px', fontWeight: '700', color: statusDesc[dgaStatus].color }}>{ieeeAssessment.condition}</div></div><div style={{ padding: '20px', background: '#f8fafc', borderRadius: '14px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Action</div><div style={{ fontSize: '18px', fontWeight: '600' }}>{ieeeAssessment.action}</div></div><div style={{ padding: '20px', background: '#f8fafc', borderRadius: '14px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Interval</div><div style={{ fontSize: '18px', fontWeight: '600' }}>{ieeeAssessment.interval}</div></div></div><div style={{ padding: '20px', background: '#f8fafc', borderRadius: '14px' }}><div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recommendations</div>{ieeeAssessment.recommendations.map((r, i) => <div key={i} style={{ padding: '12px 16px', background: '#fff', borderRadius: '10px', marginBottom: '10px', fontSize: '16px' }}>• {r}</div>)}</div></Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>📐 Rogers Ratios</h3>{rogersRatios ? <div>{[['R1',rogersRatios.r1],['R2',rogersRatios.r2],['R3',rogersRatios.r3]].map(([l,v]) => <div key={l as string} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '14px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>{l}</div><div style={{ fontSize: '28px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{(v as number).toFixed(4)}</div></div>)}<div style={{ padding: '20px', background: '#3b82f610', borderRadius: '14px', borderLeft: '4px solid #3b82f6' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Diagnosis</div><div style={{ fontSize: '18px', fontWeight: '700' }}>{rogersRatios.diagnosis}</div></div></div> : <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '16px' }}>Enter values</div>}</Card>
              <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>📊 CO₂/CO</h3>{co2coRatio ? <div><div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '14px' }}><div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>Ratio</div><div style={{ fontSize: '32px', fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' }}>{co2coRatio.ratio.toFixed(2)}</div></div><div style={{ padding: '16px', background: co2coRatio.severity === 'warning' ? '#fee2e2' : '#dcfce7', borderRadius: '12px' }}><div style={{ fontSize: '18px', fontWeight: '500', color: co2coRatio.severity === 'warning' ? '#dc2626' : '#16a34a' }}>{co2coRatio.interpretation}</div></div></div> : <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '16px' }}>Enter CO/CO₂</div>}</Card>
            </div>
            <Card style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', border: '2px solid #3b82f620' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🤖 AI Interpretation</span>
              </h3>
              <div style={{ padding: '20px', background: '#fff', borderRadius: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '16px', lineHeight: '1.7', color: '#334155' }}>
                  {(() => {
                    const insights: string[] = [];
                    
                    // Status-based insight
                    if (dgaStatus === 1) {
                      insights.push('✅ The transformer is operating within normal parameters according to IEEE C57.104-2019 standards.');
                    } else if (dgaStatus === 2) {
                      insights.push('⚠️ Elevated gas levels detected. The transformer requires increased monitoring frequency.');
                    } else {
                      insights.push('🚨 Warning condition detected. Immediate investigation and engineering review recommended.');
                    }
                    
                    // Duval Triangle insight
                    if (duvalTriangle1) {
                      const faultInfo = faultDesc[duvalTriangle1.faultZone];
                      if (faultInfo) {
                        insights.push(`🔺 Duval Triangle 1 indicates "${faultInfo.name}" fault type.`);
                      }
                    }
                    
                    // CO2/CO ratio insight
                    if (co2coRatio) {
                      if (co2coRatio.ratio < 3) {
                        insights.push('📊 Low CO₂/CO ratio suggests possible thermal degradation of cellulose insulation.');
                      } else if (co2coRatio.ratio > 10) {
                        insights.push('📊 CO₂/CO ratio indicates normal cellulose aging without significant thermal stress.');
                      }
                    }
                    
                    // Rogers ratio insight
                    if (rogersRatios) {
                      insights.push(`📐 Rogers Ratio analysis suggests: ${rogersRatios.diagnosis}.`);
                    }
                    
                    // Age consideration
                    if (transformerAge !== null) {
                      if (transformerAge < 10) {
                        insights.push(`📅 As a relatively new transformer (${transformerAge} years), stricter gas limits are applied.`);
                      } else if (transformerAge >= 30) {
                        insights.push(`📅 This is an aged transformer (${transformerAge} years). More lenient limits are applied, but closer monitoring is advised.`);
                      }
                    }
                    
                    // O2/N2 insight
                    if (o2n2Ratio <= 0.2) {
                      insights.push('🔒 O₂/N₂ ratio indicates a sealed/conservator type transformer.');
                    } else {
                      insights.push('🌬️ O₂/N₂ ratio indicates a breathing type transformer.');
                    }
                    
                    return insights.length > 0 ? insights.map((insight, i) => (
                      <div key={i} style={{ marginBottom: i < insights.length - 1 ? '12px' : '0', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                        {insight}
                      </div>
                    )) : <div style={{ color: '#94a3b8', textAlign: 'center' }}>Enter gas values to generate AI interpretation</div>;
                  })()}
                </div>
              </div>
              <div style={{ padding: '14px 18px', background: '#fef3c7', borderRadius: '10px', fontSize: '14px', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span>💡</span>
                <span>This AI interpretation is based on IEEE C57.104-2019, Duval Triangle, and Rogers Ratio methods. Always consult qualified engineers for critical decisions.</span>
              </div>
            </Card>
            {gasAnalysis.length > 0 && <Card><h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>🔬 Gas Analysis</h3><div style={{ display: 'grid', gap: '16px' }}>{gasAnalysis.map((a, i) => <div key={i} style={{ padding: '18px', background: '#f8fafc', borderRadius: '14px', borderLeft: '4px solid '+a.color }}><span style={{ padding: '6px 14px', background: a.color, borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: '600', marginRight: '12px' }}>{a.gas}</span><span style={{ fontWeight: '600', color: a.color, fontSize: '16px' }}>{a.level}</span><div style={{ fontSize: '16px', color: '#475569', marginTop: '8px' }}>{a.message}</div></div>)}</div></Card>}
          </div>
        )}

        {activeTab === 'database' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}><h3 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>🗄️ Database ({transformerList.length})</h3><button onClick={loadDemo} style={{ padding: '10px 18px', background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', cursor: 'pointer' }}>Load Demo</button></div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}><input type="text" placeholder="🔍 Search..." value={dbSearch} onChange={e => setDbSearch(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '14px 18px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px' }} /><select value={dbFilter.samplingPoint} onChange={e => setDbFilter(p => ({ ...p, samplingPoint: e.target.value }))} style={{ padding: '14px 18px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px' }}><option value="All">All Points</option><option>Main Tank</option><option>OLTC</option><option>Bushing</option></select><select value={dbFilter.status} onChange={e => setDbFilter(p => ({ ...p, status: e.target.value }))} style={{ padding: '14px 18px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px' }}><option value="All">All Status</option><option value="1">Normal</option><option value="2">Caution</option><option value="3">Warning</option></select><select value={dbFilter.site} onChange={e => setDbFilter(p => ({ ...p, site: e.target.value }))} style={{ padding: '14px 18px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px' }}>{uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              {filteredTransformers.length === 0 ? <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '18px' }}>No transformers</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>{filteredTransformers.map(t => <div key={t.id} onClick={() => setSelectedTransformer(t)} style={{ padding: '20px', background: selectedTransformer?.id === t.id ? '#eff6ff' : '#f8fafc', borderRadius: '14px', borderLeft: '4px solid '+statusDesc[t.latestStatus]?.color, cursor: 'pointer', border: selectedTransformer?.id === t.id ? '2px solid #3b82f6' : '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><div style={{ fontWeight: '700', fontSize: '17px' }}>{t.info.mnemonic || t.info.serialNumber}</div><span style={{ padding: '6px 12px', background: statusDesc[t.latestStatus]?.bg, color: statusDesc[t.latestStatus]?.color, borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>{statusDesc[t.latestStatus]?.name}</span></div><div style={{ fontSize: '15px', color: '#64748b', marginBottom: '4px' }}>{t.info.siteLocation}</div><div style={{ fontSize: '14px', color: '#94a3b8' }}>{t.info.mvaRating} MVA • {t.records.length} records</div></div>)}</div>}
            </Card>
            {selectedTransformer && <Card style={{ borderTop: '4px solid #3b82f6' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}><div><h3 style={{ fontSize: '26px', fontWeight: '700', margin: 0 }}>{selectedTransformer.info.mnemonic || selectedTransformer.info.serialNumber}</h3><div style={{ fontSize: '16px', color: '#64748b', marginTop: '6px' }}>{selectedTransformer.info.siteLocation} • {selectedTransformer.info.serialNumber}</div><div style={{ fontSize: '15px', color: '#94a3b8', marginTop: '4px' }}>{selectedTransformer.info.mvaRating} MVA • {selectedTransformer.info.voltage} kV</div></div><button onClick={() => setSelectedTransformer(null)} style={{ padding: '10px 18px', background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}>✕</button></div>{selectedTxTrend.length >= 2 && <div style={{ marginBottom: '24px' }}><h4 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>📈 Trend</h4><ResponsiveContainer width="100%" height={280}><LineChart data={selectedTxTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" stroke="#94a3b8" fontSize={14} /><YAxis stroke="#94a3b8" fontSize={14} /><Tooltip contentStyle={{ fontSize: '14px' }} /><Legend wrapperStyle={{ fontSize: '14px' }} /><Line type="monotone" dataKey="H2" stroke={gasColors.H2} strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="CH4" stroke={gasColors.CH4} strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="C2H4" stroke={gasColors.C2H4} strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="C2H2" stroke={gasColors.C2H2} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>}<h4 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>📋 History ({selectedTransformer.records.length})</h4><div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>{selectedTransformer.records.map((r, i) => <div key={r.id} style={{ padding: '18px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid '+statusDesc[r.analysis.dgaStatus]?.color }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><div style={{ fontWeight: '600', fontSize: '16px' }}>{r.transformer.sampleDate}</div><span style={{ padding: '6px 12px', background: statusDesc[r.analysis.dgaStatus]?.bg, color: statusDesc[r.analysis.dgaStatus]?.color, borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}>S{r.analysis.dgaStatus}</span></div><div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#64748b', fontFamily: 'monospace', flexWrap: 'wrap' }}>{['H2','CH4','C2H4','C2H2'].map(g => <span key={g}>{g}:{r.gasValues[g]||'—'}</span>)}<span>TDCG:{r.analysis.tdcg}</span></div><button onClick={() => { setGasValues(r.gasValues); setTransformerInfo(r.transformer); setActiveTab('input'); }} style={{ marginTop: '12px', padding: '8px 16px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Load</button></div>)}</div></Card>}
          </div>
        )}

        {activeTab === 'records' && (
          <Card><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}><h3 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>📁 All Records ({savedRecords.length})</h3>{savedRecords.length > 0 && <button onClick={() => setSavedRecords([])} style={{ padding: '10px 18px', background: '#fee2e2', border: 'none', borderRadius: '10px', color: '#dc2626', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Clear All</button>}</div>{savedRecords.length === 0 ? <div style={{ padding: '100px', textAlign: 'center' }}><div style={{ fontSize: '60px', marginBottom: '20px' }}>📂</div><div style={{ color: '#64748b', fontSize: '18px' }}>No records</div></div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{savedRecords.map((r, i) => <div key={r.id} style={{ padding: '20px', background: '#f8fafc', borderRadius: '14px', borderLeft: '4px solid '+statusDesc[r.analysis.dgaStatus]?.color }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><div><div style={{ fontWeight: '600', fontSize: '18px' }}>{r.transformer.mnemonic || r.transformer.serialNumber || 'Record '+(savedRecords.length-i)}</div><div style={{ fontSize: '15px', color: '#64748b', marginTop: '4px' }}>{r.transformer.siteLocation} • {r.transformer.sampleDate}</div></div><span style={{ padding: '6px 14px', background: statusDesc[r.analysis.dgaStatus]?.bg, color: statusDesc[r.analysis.dgaStatus]?.color, borderRadius: '8px', fontSize: '15px', fontWeight: '600' }}>S{r.analysis.dgaStatus}</span></div><div style={{ display: 'flex', gap: '18px', fontSize: '15px', color: '#64748b', fontFamily: 'monospace', flexWrap: 'wrap' }}>{['H2','CH4','C2H4','C2H2','CO'].map(g => <span key={g}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: gasColors[g], marginRight: '6px' }}></span>{g}:{r.gasValues[g]||'—'}</span>)}</div><div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}><button onClick={() => { setGasValues(r.gasValues); setTransformerInfo(r.transformer); setActiveTab('input'); }} style={{ padding: '10px 18px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>Load</button><button onClick={() => setSavedRecords(p => p.filter(x => x.id !== r.id))} style={{ padding: '10px 18px', background: '#fff', border: '2px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '15px', cursor: 'pointer' }}>Delete</button></div></div>)}</div>}</Card>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '32px', marginTop: '40px' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
            DGA Analysis Tool - Based on IEEE C57.104-2019
          </div>
          <div style={{ fontSize: '15px', color: '#475569', marginBottom: '16px' }}>
            Developed by{' '}
            <a 
              href="https://www.linkedin.com/in/chm-hadi-fauzi/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}
              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              CHM. Ts. Hadi Fauzi, MRSC
            </a>
          </div>
          <div style={{ 
            padding: '12px 20px', 
            background: '#fef3c7', 
            border: '1px solid #fbbf24', 
            borderRadius: '8px', 
            fontSize: '14px', 
            color: '#92400e',
            fontWeight: '500',
            marginBottom: '16px'
          }}>
            ⚠️ For reference only - consult qualified Chemist and Engineers for critical decisions
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '12px' }}>
            © 2026 DGA Analyzer Pro. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
