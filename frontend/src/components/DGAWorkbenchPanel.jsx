import React, { useEffect, useMemo, useState } from 'react';
import AnalysisBoard from './dga-workbench/AnalysisBoard';
import { OIL_OPTIONS, getStandardOptionsForOilType } from '../lib/dga/appConfig';
import { FAULT_METADATA, analyzeSample, createEmptySample } from '../lib/dga/diagnostics';
import { Badge as UIBadge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const METHOD_OPTIONS = [
  { value: 'triangle', label: 'Duval', sides: 3 },
  { value: 'pentagon', label: 'Pentagon', sides: 5 },
  { value: 'heptagon', label: 'Heptagon', sides: 7 },
];

const HEPTAGON_KEYS = ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2', 'co', 'co2'];
const TRIANGLE_ZONE_KEYS = {
  mineral: 'triangle1',
  soybean: 'triangle3_soybean',
  rapeseed: 'triangle3_rapeseed',
  sunflower: 'triangle3_sunflower',
  synthetic: 'triangle3_synthetic',
};
const PENTAGON_ZONE_KEYS = {
  mineral: 'pentagon',
  soybean: 'pentagon3_soybean',
  rapeseed: 'pentagon3_rapeseed',
  sunflower: 'pentagon3_sunflower',
  synthetic: 'pentagon3_synthetic',
};

function getPolygonPoints(sides, radius = 8.5, center = 12, startAngle = -90) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (startAngle + (360 / sides) * index) * (Math.PI / 180);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function getCurrentTheme() {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  const savedMode = window.localStorage?.getItem('tam-color-mode');
  if (savedMode === 'dark' || savedMode === 'light') {
    return savedMode;
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function toSampleValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function getNumericId(value) {
  const numericId = Number(value);
  return Number.isFinite(numericId) ? numericId : 0;
}

function compareSamplesByDateThenId(left, right) {
  const leftDate = left.date || '';
  const rightDate = right.date || '';

  if (leftDate === rightDate) {
    return getNumericId(left.id) - getNumericId(right.id);
  }

  return leftDate.localeCompare(rightDate);
}

function formatDisplayDate(value) {
  if (!value) {
    return 'Undated';
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getSampleYear(testDate) {
  const year = Number(String(testDate || '').slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function getBuiltYear(yearBuilt) {
  const match = String(yearBuilt || '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function getTransformerAge(yearBuilt, testDate) {
  const builtYear = getBuiltYear(yearBuilt);
  const sampleYear = getSampleYear(testDate);

  if (!builtYear || !sampleYear) {
    return '';
  }

  return String(Math.max(0, sampleYear - builtYear));
}

function normaliseTestTypeForDisplay(value) {
  return String(value || 'Routine').trim() || 'Routine';
}

function resolveBuiltYearSource(transformer) {
  return transformer?.dateManufactured || transformer?.yearBuilt || transformer?.dateEnergized || '';
}

function mapOilTestToSample(test, transformer) {
  const sampleDate = test.date || test.testDate || test.samplingDate || '';
  const builtYearSource = resolveBuiltYearSource(transformer);

  return {
    id: test.id,
    date: String(sampleDate || '').slice(0, 10),
    h2: toSampleValue(test.H2 ?? test.h2),
    ch4: toSampleValue(test.CH4 ?? test.ch4),
    c2h6: toSampleValue(test.C2H6 ?? test.c2h6),
    c2h4: toSampleValue(test.C2H4 ?? test.c2h4),
    c2h2: toSampleValue(test.C2H2 ?? test.c2h2),
    co: toSampleValue(test.CO ?? test.co),
    co2: toSampleValue(test.CO2 ?? test.co2),
    o2: toSampleValue(test.O2 ?? test.o2),
    n2: toSampleValue(test.N2 ?? test.n2),
    transformerAge: getTransformerAge(builtYearSource, sampleDate),
    testType: normaliseTestTypeForDisplay(test.testType),
  };
}

function formatMetricValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return `${value}${suffix}`.trim();
}

function resolveOilType(value, oilBrand = '') {
  if (OIL_OPTIONS.some((option) => option.value === value)) {
    return value;
  }

  const text = `${value || ''} ${oilBrand || ''}`.toLowerCase();
  if (text.includes('synthetic') || text.includes('midel')) return 'synthetic';
  if (text.includes('rapeseed') || text.includes('canola')) return 'rapeseed';
  if (text.includes('sunflower')) return 'sunflower';
  if (text.includes('soybean') || text.includes('soya') || text.includes('fr3') || text.includes('natural ester')) return 'soybean';
  return 'mineral';
}

function resolveMethodView(value) {
  return METHOD_OPTIONS.some((option) => option.value === value) ? value : 'triangle';
}

function resolveGasLimitStandard(value, oilType) {
  const options = getStandardOptionsForOilType(oilType);
  if (options.some((option) => option.value === value)) {
    return value;
  }
  return options[0]?.value ?? 'IEEE_2019';
}

function getInitialPreferences(transformer) {
  const nextOilType = resolveOilType(transformer?.oilType, transformer?.oilBrand);
  return {
    oilType: nextOilType,
    gasLimitStandard: resolveGasLimitStandard(transformer?.gasLimitStandard, nextOilType),
    methodView: resolveMethodView(transformer?.methodView),
  };
}

function formatFaultZoneLabel(zone) {
  if (!zone) {
    return 'Pending';
  }

  const meta = FAULT_METADATA[zone];
  return meta?.label ? `${zone} (${meta.label})` : zone;
}

const SAMPLE_GAS_FIELDS = [
  { key: 'h2', label: 'Hydrogen', formula: 'H\u2082' },
  { key: 'ch4', label: 'Methane', formula: 'CH\u2084' },
  { key: 'c2h6', label: 'Ethane', formula: 'C\u2082H\u2086' },
  { key: 'c2h4', label: 'Ethylene', formula: 'C\u2082H\u2084' },
  { key: 'c2h2', label: 'Acetylene', formula: 'C\u2082H\u2082' },
  { key: 'co', label: 'Carbon monoxide', formula: 'CO' },
  { key: 'co2', label: 'Carbon dioxide', formula: 'CO\u2082' },
  { key: 'o2', label: 'Oxygen', formula: 'O\u2082' },
  { key: 'n2', label: 'Nitrogen', formula: 'N\u2082' },
];

function formatGasValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return `${numeric} ppm`;
}


const SAMPLE_TOOLTIP_WIDTH = 320;
const SAMPLE_TOOLTIP_HEIGHT = 252;
const SAMPLE_TOOLTIP_GAP = 8;
const SAMPLE_TOOLTIP_VIEWPORT_PADDING = 12;

function getSampleTooltipPosition(triggerRect) {
  if (typeof window === 'undefined') {
    return {
      x: triggerRect.left + triggerRect.width / 2,
      y: triggerRect.bottom + SAMPLE_TOOLTIP_GAP,
    };
  }

  const centerX = triggerRect.left + triggerRect.width / 2;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableWidth = Math.max(0, viewportWidth - SAMPLE_TOOLTIP_VIEWPORT_PADDING * 2);
  const tooltipWidth = Math.min(SAMPLE_TOOLTIP_WIDTH, availableWidth || SAMPLE_TOOLTIP_WIDTH);
  const halfWidth = tooltipWidth / 2;
  const minCenterX = SAMPLE_TOOLTIP_VIEWPORT_PADDING + halfWidth;
  const maxCenterX = viewportWidth - SAMPLE_TOOLTIP_VIEWPORT_PADDING - halfWidth;

  const x =
    maxCenterX >= minCenterX
      ? Math.min(Math.max(centerX, minCenterX), maxCenterX)
      : viewportWidth / 2;

  const preferredBelowY = triggerRect.bottom + SAMPLE_TOOLTIP_GAP;
  const maxTopY = viewportHeight - SAMPLE_TOOLTIP_VIEWPORT_PADDING - SAMPLE_TOOLTIP_HEIGHT;

  const y =
    preferredBelowY <= maxTopY
      ? preferredBelowY
      : Math.max(SAMPLE_TOOLTIP_VIEWPORT_PADDING, triggerRect.top - SAMPLE_TOOLTIP_HEIGHT - SAMPLE_TOOLTIP_GAP);

  return { x, y };
}

export default function DGAWorkbenchPanel({
  transformer,
  oilTests = [],
  readOnly = false,
  selectedTestId = null,
  selectedDate = '',
  colorMode = null,
}) {
  const initialPreferences = getInitialPreferences(transformer);
  const [theme, setTheme] = useState(colorMode || getCurrentTheme);
  const [oilType, setOilType] = useState(initialPreferences.oilType);
  const [gasLimitStandard, setGasLimitStandard] = useState(initialPreferences.gasLimitStandard);
  const [methodView, setMethodView] = useState(initialPreferences.methodView);
  const [selectedSampleId, setSelectedSampleId] = useState(selectedTestId);
  const [hoveredSample, setHoveredSample] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const showTooltip = (event, sample) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPos(getSampleTooltipPosition(rect));
    setHoveredSample(sample);
  };

  const hideTooltip = () => setHoveredSample(null);

  const standardOptions = useMemo(() => getStandardOptionsForOilType(oilType), [oilType]);

  useEffect(() => {
    setSelectedSampleId(selectedTestId);
  }, [selectedTestId]);

  useEffect(() => {
    if (colorMode === 'dark' || colorMode === 'light') {
      setTheme(colorMode);
    }
  }, [colorMode]);

  useEffect(() => {
    const nextPreferences = getInitialPreferences(transformer);
    setOilType(nextPreferences.oilType);
    setGasLimitStandard(nextPreferences.gasLimitStandard);
    setMethodView(nextPreferences.methodView);
  }, [transformer?.id, transformer?.oilType, transformer?.oilBrand, transformer?.gasLimitStandard, transformer?.methodView]);

  useEffect(() => {
    if (!standardOptions.some((option) => option.value === gasLimitStandard)) {
      setGasLimitStandard(standardOptions[0]?.value ?? 'IEEE_2019');
    }
  }, [gasLimitStandard, standardOptions]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const syncTheme = () => setTheme(getCurrentTheme());

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const emptyAnalysis = useMemo(
    () => analyzeSample(createEmptySample(0), gasLimitStandard, oilType),
    [gasLimitStandard, oilType],
  );

  const reportSamples = useMemo(
    () =>
      oilTests
        .map((test) => mapOilTestToSample(test, transformer))
        .sort(compareSamplesByDateThenId)
        .map((sample, index) => ({
          ...sample,
          id: sample.id ?? `${sample.date || 'sample'}-${index + 1}`,
          sampleNumber: index + 1,
          analysis: analyzeSample(sample, gasLimitStandard, oilType),
        })),
    [gasLimitStandard, oilTests, oilType, transformer],
  );

  const completedSamples = useMemo(
    () => reportSamples.filter((sample) => sample.analysis.requiredGasCount === 5),
    [reportSamples],
  );

  const latestSample = completedSamples[completedSamples.length - 1] ?? reportSamples[reportSamples.length - 1] ?? null;
  const focusSample =
    reportSamples.find((sample) => sample.id === selectedSampleId) ??
    reportSamples.find((sample) => sample.date === selectedDate) ??
    latestSample ??
    reportSamples[0] ??
    null;
  const focusAnalysis = focusSample?.analysis ?? emptyAnalysis;
  const triangleZoneKey = TRIANGLE_ZONE_KEYS[oilType] ?? 'triangle1';
  const pentagonZoneKey = PENTAGON_ZONE_KEYS[oilType] ?? 'pentagon';
  const triangle1Zone = focusAnalysis.faultZones?.[triangleZoneKey] ?? focusAnalysis.faultZones?.triangle1 ?? null;
  const triangle4Zone = focusAnalysis.faultZones?.triangle4 ?? null;
  const triangle5Zone = focusAnalysis.faultZones?.triangle5 ?? null;
  const triangle6Zone = focusAnalysis.faultZones?.triangle6 ?? null;
  const pentagonZone = focusAnalysis.faultZones?.[pentagonZoneKey] ?? focusAnalysis.faultZones?.pentagon ?? null;
  const followUpTriangles = [
    { title: 'Duval Triangle 4', zone: triangle4Zone },
    { title: 'Duval Triangle 5', zone: triangle5Zone },
  ].filter((item) => item.zone);
  const heptagonZone = focusAnalysis.heptagon?.zone ?? focusAnalysis.faultZones?.heptagon ?? null;
  const hasHeptagonData = HEPTAGON_KEYS.every((key) => focusAnalysis.raw?.[key] != null);
  const oilLabel = OIL_OPTIONS.find((option) => option.value === oilType)?.label ?? oilType;
  const builtYear = getBuiltYear(resolveBuiltYearSource(transformer));
  const transformerAge = getTransformerAge(resolveBuiltYearSource(transformer), focusSample?.date);
  const transformerAgeLabel = transformerAge
    ? `${transformerAge} year${transformerAge === '1' ? '' : 's'}`
    : 'Unavailable';

  return (
    <div data-dga-workbench data-color-mode={theme} className="space-y-5">
      <Card variant="glass" className="px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Integrated DGA workspace</div>
              <h4 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                {transformer?.name || transformer?.mnemonic || transformer?.serialNumber || 'Transformer history'}
              </h4>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Records are ordered by test date so the diagrams and trend table follow the sample history.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <UIBadge variant="outline" className="px-3 py-1.5 text-[var(--foreground)]">
                {oilTests.length} record{oilTests.length === 1 ? '' : 's'}
              </UIBadge>
              <UIBadge variant="outline" className="px-3 py-1.5 text-[var(--foreground)]">
                Focus: {focusSample ? formatDisplayDate(focusSample.date) : '-'}
              </UIBadge>
              <UIBadge variant="outline" className="px-3 py-1.5 text-[var(--foreground)]">
                Test type: {focusSample?.testType || '-'}
              </UIBadge>
              <UIBadge variant="outline" className="px-3 py-1.5 text-[var(--foreground)]">
                Theme: {theme}
              </UIBadge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:min-w-[640px]">
            <div className="space-y-2 text-sm">
              <Label className="text-[var(--muted)]">Insulating liquid</Label>
              <Select value={oilType} onValueChange={setOilType} disabled={readOnly}>
                <SelectTrigger className="text-[var(--foreground)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OIL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--muted)]">Method view</Label>
              <div className="grid grid-cols-3 gap-2">
                {METHOD_OPTIONS.map((option) => {
                  const isActive = methodView === option.value;
                  const polygonPoints = getPolygonPoints(option.sides);
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'primary' : 'secondary'}
                      size="md"
                      onClick={() => setMethodView(option.value)}
                      aria-label={option.label}
                      title={option.label}
                      disabled={readOnly}
                      className="h-10 w-full px-0"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <polygon
                          points={polygonPoints}
                          fill={isActive ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="sr-only">{option.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <Label className="text-[var(--muted)]">Gas limit standard</Label>
              <Select value={gasLimitStandard} onValueChange={setGasLimitStandard} disabled={readOnly || standardOptions.length === 1}>
                <SelectTrigger className="text-[var(--foreground)] disabled:opacity-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {standardOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-[var(--muted)]">
          {readOnly
            ? <span>Viewer mode: diagnostic options are read-only.</span>
            : <span>Diagnostic options update this view only. Transformer oil brand is used to pick the initial oil family.</span>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Duval Triangle</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatFaultZoneLabel(triangle1Zone)}</div>
            <div className="mt-1 space-y-1 text-xs text-[var(--muted)]">
              {oilType === 'mineral' ? (
                followUpTriangles.length ? (
                  followUpTriangles.map((item) => (
                    <div key={item.title}>
                      {item.title}: {formatFaultZoneLabel(item.zone)}
                    </div>
                  ))
                ) : (
                  <div>Triangle 4/5 not triggered</div>
                )
              ) : (
                <div>Triangle 6: {formatFaultZoneLabel(triangle6Zone)}</div>
              )}
            </div>
          </div>
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Duval Pentagon</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatFaultZoneLabel(pentagonZone)}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{oilLabel}</div>
          </div>
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Heptagon</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{heptagonZone || 'Pending CO / CO2'}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{hasHeptagonData ? (FAULT_METADATA[heptagonZone]?.label || 'Seven-gas view ready') : 'Needs H2, CH4, C2H6, C2H4, C2H2, CO, and CO2.'}</div>
          </div>
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">TDCG</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatMetricValue(focusAnalysis.metrics?.tdcg, ' ppm')}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">H2 + CH4 + C2H6 + C2H4 + C2H2 + CO</div>
          </div>
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Ratios</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              CO2 / CO {formatMetricValue(focusAnalysis.metrics?.co2CoRatio)}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              O2 / N2 {formatMetricValue(focusAnalysis.metrics?.o2N2Ratio)}
            </div>
          </div>
          <div className="rounded-md bg-[var(--card)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Transformer age</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{transformerAgeLabel}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">Built year {builtYear ?? '-'}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">As of {focusSample ? formatDisplayDate(focusSample.date) : '-'}</div>
          </div>
        </div>
      </Card>

      <section className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-[var(--foreground)]">Sample history</h5>
            <p className="mt-1 text-xs text-[var(--muted)]">Choose a record to change the active analysis while keeping the full transformer history in the charts.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {reportSamples.map((sample) => {
            const isActive = sample.id === focusSample?.id;
            const sampleLabel = sample.analysis.primaryFault?.code ?? (sample.analysis.requiredGasCount === 5 ? 'Ready' : 'Pending');

            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => setSelectedSampleId(sample.id)}
                onPointerEnter={(event) => showTooltip(event, sample)}
                onPointerLeave={hideTooltip}
                onFocus={(event) => showTooltip(event, sample)}
                onBlur={hideTooltip}
                className={`min-w-[168px] rounded-md border px-3 py-3 text-left transition ${
                  isActive
                    ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[color:var(--border)] bg-[var(--card-muted)] hover:bg-[var(--card-strong)]'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  #{sample.sampleNumber} {sample.testType ? `- ${sample.testType}` : ''}
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDisplayDate(sample.date)}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{sampleLabel}</div>
              </button>
            );
          })}
        </div>

        {hoveredSample ? (
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: tooltipPos.y,
              left: tooltipPos.x,
              transform: 'translateX(-50%)',
              width: 'min(20rem, calc(100vw - 24px))',
              zIndex: 1000,
            }}
            className="pointer-events-none rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--foreground)] shadow-lg"
          >
            <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <span>Sample #{hoveredSample.sampleNumber} - {formatDisplayDate(hoveredSample.date)}</span>
              <span className="text-[10px] normal-case tracking-normal">
                {standardOptions.find((option) => option.value === gasLimitStandard)?.label ?? gasLimitStandard}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-baseline">
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Gas</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] text-right">Value</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] text-right">Limit</span>
              {SAMPLE_GAS_FIELDS.map((gas) => {
                const detail = hoveredSample.analysis?.gasLimitDetails?.[gas.key];
                const limit = detail?.activeLimit;
                const exceeded = Boolean(detail?.exceeded);
                return (
                  <React.Fragment key={gas.key}>
                    <span className="text-[var(--muted)]">
                      {gas.label} <span className="text-[10px]">({gas.formula})</span>
                    </span>
                    <span
                      className={`text-right ${exceeded ? 'font-bold text-red-600' : 'font-medium text-[var(--foreground)]'}`}
                    >
                      {formatGasValue(hoveredSample[gas.key])}
                    </span>
                    <span className="text-right text-[var(--muted)]">
                      {limit != null ? `${limit} ppm` : '-'}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : null}

        {focusAnalysis.requiredGasCount < 5 ? (
          <div className="mt-4 rounded-md border border-[color:var(--warning-strong)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
            This focused sample is missing one or more core gases. The workspace still keeps the full dated history, and any complete samples continue to plot in the Duval, Pentagon, Heptagon, and trending views.
          </div>
        ) : null}
      </section>

      <AnalysisBoard
        oilType={oilType}
        methodView={methodView}
        theme={theme}
        reportSamples={reportSamples}
        completedSamples={completedSamples}
        latestSample={latestSample}
        focusSample={focusSample}
        focusAnalysis={focusAnalysis}
      />
    </div>
  );
}
