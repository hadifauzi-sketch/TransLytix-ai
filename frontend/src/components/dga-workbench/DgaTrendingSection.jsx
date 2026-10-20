import { useEffect, useMemo, useState } from "react";
import { GAS_COLORS } from "../../lib/dga/appConfig.js";

const TREND_SERIES = [
  { key: "h2", label: "Hydrogen", formula: "H2", color: GAS_COLORS.h2 },
  { key: "ch4", label: "Methane", formula: "CH4", color: GAS_COLORS.ch4 },
  { key: "c2h6", label: "Ethane", formula: "C2H6", color: GAS_COLORS.c2h6 },
  { key: "c2h4", label: "Ethylene", formula: "C2H4", color: GAS_COLORS.c2h4 },
  { key: "c2h2", label: "Acetylene", formula: "C2H2", color: GAS_COLORS.c2h2 },
  { key: "co", label: "Carbon Monoxide", formula: "CO", color: "#f97316" },
  { key: "co2", label: "Carbon Dioxide", formula: "CO2", color: "#7c3aed" },
  { key: "tdcg", label: "TDCG", color: "#475569", dash: "8 6" },
];

const GAS_KEYS = TREND_SERIES.filter((series) => series.key !== "tdcg").map((series) => series.key);
const TDCG_KEYS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co"];
const PENTAGON_KEYS = {
  mineral: "pentagon",
  soybean: "pentagon3_soybean",
  rapeseed: "pentagon3_rapeseed",
  sunflower: "pentagon3_sunflower",
  synthetic: "pentagon3_synthetic",
};
const FAULT_COLUMN_DEFINITIONS = [
  { key: "triangle1", title: "Triangle 1", sides: 3, marker: "1" },
  { key: "triangle4", title: "Triangle 4", sides: 3, marker: "4" },
  { key: "triangle5", title: "Triangle 5", sides: 3, marker: "5" },
  { key: "pentagon", title: "Pentagon", sides: 5, marker: null },
  { key: "heptagon", title: "Heptagon", sides: 7, marker: null },
];
const CHART_WIDTH = 980;
const CHART_HEIGHT = 360;
const CHART_MARGIN = { top: 20, right: 18, bottom: 54, left: 70 };
const PLOT_WIDTH = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
const TREND_TABLE_PAGE_SIZE = 6;

function ChemicalFormula({ formula = "" }) {
  const tokens = String(formula).split(/(\d+)/).filter(Boolean);

  return (
    <>
      {tokens.map((token, index) =>
        /^\d+$/.test(token) ? (
          <sub key={`${formula}-${index}`}>{token}</sub>
        ) : (
          <span key={`${formula}-${index}`}>{token}</span>
        ),
      )}
    </>
  );
}

function getSeriesLabelText(series) {
  if (!series.formula) {
    return series.label;
  }

  return `${series.label} (${series.formula})`;
}

function SeriesLabel({ series, stacked = false }) {
  if (!series.formula) {
    return <span className="normal-case tracking-normal">{series.label}</span>;
  }

  if (stacked) {
    return (
      <span className="inline-flex flex-col items-center leading-tight normal-case tracking-normal">
        <span className="text-[12px] font-semibold text-[var(--foreground)]">{series.label}</span>
        <span className="text-[11px] font-semibold opacity-90">
          <ChemicalFormula formula={series.formula} />
        </span>
      </span>
    );
  }

  return (
    <span className="normal-case tracking-normal">
      {series.label} (<ChemicalFormula formula={series.formula} />)
    </span>
  );
}

function buildTrendRowKey(id, date) {
  return `${date || "undated"}::${id ?? ""}`;
}

function toNumericValue(value) {
  if (value == null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatHistoryDate(date) {
  return date ? date.replace(/-/g, "/") : "-";
}

function formatAxisDate(date, fallbackId) {
  if (!date) {
    return `#${fallbackId ?? "-"}`;
  }

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return formatHistoryDate(date);
  }

  return `${day}/${month}`;
}

function compareTrendSamples(left, right) {
  const leftDate = left.date || "";
  const rightDate = right.date || "";

  if (leftDate && rightDate && leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  if (!leftDate && rightDate) {
    return 1;
  }

  if (leftDate && !rightDate) {
    return -1;
  }

  const leftId = Number(left.id);
  const rightId = Number(right.id);

  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }

  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function calculateTdcg(values) {
  const presentValues = TDCG_KEYS.map((key) => values[key]).filter((value) => value != null);

  if (!presentValues.length) {
    return null;
  }

  return presentValues.reduce((sum, value) => sum + value, 0);
}

function calculateTrend(current, previous) {
  if (current == null || previous == null) {
    return null;
  }

  if (current === 0 && previous === 0) {
    return null;
  }

  const difference = current - previous;

  if (Math.abs(difference) < 0.001) {
    return {
      direction: "flat",
      percent: 0,
    };
  }

  return {
    direction: difference > 0 ? "up" : "down",
    percent: previous !== 0 ? Math.round((difference / previous) * 100) : 100,
  };
}

function getSampleFaults(sample, oilType) {
  const faultZones = sample.analysis?.faultZones ?? {};
  const pentagonKey = PENTAGON_KEYS[oilType] ?? "pentagon";

  return {
    triangle1: faultZones.triangle1 ?? null,
    triangle4: faultZones.triangle4 ?? null,
    triangle5: faultZones.triangle5 ?? null,
    pentagon: faultZones[pentagonKey] ?? faultZones.pentagon ?? null,
    heptagon: sample.analysis?.heptagon?.zone ?? faultZones.heptagon ?? null,
  };
}

function buildTrendRows(samples = [], oilType = "mineral") {
  const rows = [...samples]
    .sort(compareTrendSamples)
    .map((sample) => {
      const values = Object.fromEntries(GAS_KEYS.map((key) => [key, toNumericValue(sample[key])])) ;
      const tdcg = calculateTdcg(values);
      const hasAnyGasValue = [...Object.values(values), tdcg].some((value) => value != null);

      if (!hasAnyGasValue) {
        return null;
      }

      const displayId = sample.sampleNumber ?? sample.id;

      return {
        id: sample.id,
        displayId,
        date: sample.date || "",
        rowKey: buildTrendRowKey(sample.id, sample.date || ""),
        dateLabel: formatHistoryDate(sample.date || ""),
        axisLabel: formatAxisDate(sample.date || "", displayId),
        values: {
          ...values,
          tdcg,
        },
        faults: getSampleFaults(sample, oilType),
      };
    })
    .filter(Boolean);

  return rows.map((row, index) => {
    const previousRow = index > 0 ? rows[index - 1] : null;

    return {
      ...row,
      trends: Object.fromEntries(
        TREND_SERIES.map((series) => [
          series.key,
          calculateTrend(row.values[series.key], previousRow?.values?.[series.key] ?? null),
        ]),
      ),
    };
  });
}

function formatValue(value) {
  if (value == null) {
    return "--";
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatAxisValue(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function getChartMaximum(maxValue) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }

  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep || 1));
  const normalized = roughStep / magnitude;
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceStep * magnitude;

  return Math.ceil(maxValue / step) * step;
}

function buildLinePath(points) {
  let path = "";
  let hasActiveSegment = false;

  points.forEach((point) => {
    if (point.value == null) {
      hasActiveSegment = false;
      return;
    }

    path += `${hasActiveSegment ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    hasActiveSegment = true;
  });

  return path.trim();
}

function getThemePalette(isDarkMode) {
  return {
    mutedText: "var(--text-muted)",
    badgeText: "var(--text)",
    badgeBorder: "var(--accent-border)",
    badgeBg: "var(--bg-card)",
    badgeEmptyText: "var(--text-muted)",
    iconFill: "var(--bg-card)",
    iconStroke: "var(--text-muted)",
    iconText: "var(--text-dim)",
    chartBg: "var(--bg-card)",
    chartGrid: "var(--accent-border)",
    axisText: "var(--text-muted)",
    axisLine: "var(--border-light)",
    selectedBand: "var(--accent)",
    selectedLine: "var(--accent-border-strong)",
    selectedLabelBg: "var(--bg-input)",
    selectedLabelStroke: "var(--accent-border-strong)",
    selectedLabelText: "var(--text)",
    pointStroke: "var(--bg-card)",
    tableHeadBg: "var(--bg-input)",
    tableHeadText: "var(--text-muted)",
    tableRowEvenBg: "var(--bg-card)",
    tableRowOddBg: "var(--bg-input)",
    tableRowBorder: "var(--border)",
    numberText: "var(--text-dim)",
    strongText: "var(--text)",
    selectedDateText: "var(--text)",
    rowPulseStartBg: "var(--accent-soft)",
    rowPulseMidBg: "var(--accent-soft-strong)",
    rowPulseStartShadow: "inset 0 0 0 1px var(--accent-border), inset 0 0 18px var(--accent-soft)",
    rowPulseMidShadow: "inset 0 0 0 1px var(--accent-border-strong), inset 0 0 28px var(--accent-soft-strong)",
    legendActiveBg: "var(--bg-card)",
    legendActiveBorder: "var(--accent-border-strong)",
    legendActiveText: "var(--text)",
    legendInactiveBg: "var(--bg-input)",
    legendInactiveBorder: "var(--accent-border)",
    legendInactiveText: "var(--text-muted)",
    emptyBg: "var(--bg-card)",
    emptyBorder: "var(--border)",
    emptyText: "var(--text-muted)",
    sectionBorder: "var(--border)",
  };
}

function TrendBadge({ trend, mutedText }) {
  if (!trend) {
    return <span className="text-[12px] font-medium" style={{ color: mutedText }}>--</span>;
  }

  if (trend.direction === "flat") {
    return <span className="text-[12px] font-medium" style={{ color: mutedText }}>0%</span>;
  }

  const isUp = trend.direction === "up";

  return (
    <span className="text-[12px] font-semibold" style={{ color: isUp ? "var(--warning)" : "var(--success)" }}>
      {trend.percent > 0 ? "+" : ""}
      {trend.percent}%
    </span>
  );
}

function buildRegularPolygonPoints(sides, radius = 9, center = 12) {
  const angleOffset = -Math.PI / 2;

  return Array.from({ length: sides }, (_, index) => {
    const angle = angleOffset + (2 * Math.PI * index) / sides;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function FaultMethodIcon({ title, sides, marker, palette }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center" title={title}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <polygon points={buildRegularPolygonPoints(sides)} fill={palette.iconFill} stroke={palette.iconStroke} strokeWidth="1.6" />
        {marker ? (
          <text
            x="12"
            y="14.2"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill={palette.iconText}
            style={{ userSelect: "none" }}
          >
            {marker}
          </text>
        ) : null}
      </svg>
      <span className="sr-only">{title}</span>
    </span>
  );
}

function FaultZoneBadge({ value, palette }) {
  if (!value) {
    return <span className="text-[11px] font-medium" style={{ color: palette.badgeEmptyText }}>--</span>;
  }

  return (
    <span
      className="inline-flex min-w-[38px] justify-center rounded-full border px-2 py-1 text-[11px] font-semibold"
      style={{
        borderColor: palette.badgeBorder,
        backgroundColor: palette.badgeBg,
        color: palette.badgeText,
      }}
    >
      {value}
    </span>
  );
}

function getRowCellStyle(isSelected, baseBackground, palette, emphasis = false) {
  if (!isSelected) {
    return { backgroundColor: baseBackground };
  }

  return {
    backgroundColor: emphasis ? palette.rowPulseMidBg : palette.rowPulseStartBg,
    animation: "dgaTrendRowPulse 2.8s ease-in-out infinite",
  };
}

export default function DgaTrendingSection({ samples = [], oilType = "mineral", theme = "light" }) {
  const isDarkMode = theme === "dark";
  const palette = getThemePalette(isDarkMode);
  const [visibleSeries, setVisibleSeries] = useState(() =>
    Object.fromEntries(TREND_SERIES.map((series) => [series.key, true])),
  );
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [tablePage, setTablePage] = useState(1);

  const trendRows = useMemo(() => buildTrendRows(samples, oilType), [oilType, samples]);
  const visibleTrendSeries = useMemo(
    () => TREND_SERIES.filter((series) => visibleSeries[series.key]),
    [visibleSeries],
  );
  const faultColumns = useMemo(
    () =>
      FAULT_COLUMN_DEFINITIONS.filter((column) => trendRows.some((row) => row.faults?.[column.key])),
    [trendRows],
  );
  const selectedRow = useMemo(
    () => trendRows.find((row) => row.rowKey === selectedRowKey) ?? null,
    [selectedRowKey, trendRows],
  );
  const selectedRowIndex = useMemo(
    () => trendRows.findIndex((row) => row.rowKey === selectedRowKey),
    [selectedRowKey, trendRows],
  );
  const tableRows = useMemo(() => [...trendRows].reverse(), [trendRows]);
  const totalTablePages = useMemo(
    () => Math.max(1, Math.ceil(tableRows.length / TREND_TABLE_PAGE_SIZE)),
    [tableRows.length],
  );
  const tableStartIndex = useMemo(
    () => (tablePage - 1) * TREND_TABLE_PAGE_SIZE,
    [tablePage],
  );
  const pagedTrendRows = useMemo(
    () => tableRows.slice(tableStartIndex, tableStartIndex + TREND_TABLE_PAGE_SIZE),
    [tableRows, tableStartIndex],
  );

  const chartMax = useMemo(() => {
    const maxValue = Math.max(
      0,
      ...visibleTrendSeries.flatMap((series) =>
        trendRows
          .map((row) => row.values[series.key])
          .filter((value) => value != null),
      ),
    );

    return getChartMaximum(maxValue);
  }, [trendRows, visibleTrendSeries]);

  const yTicks = useMemo(
    () => Array.from({ length: 5 }, (_, index) => (chartMax * index) / 4),
    [chartMax],
  );

  useEffect(() => {
    if (selectedRowKey && !trendRows.some((row) => row.rowKey === selectedRowKey)) {
      setSelectedRowKey(null);
    }
  }, [selectedRowKey, trendRows]);

  useEffect(() => {
    if (tablePage > totalTablePages) {
      setTablePage(totalTablePages);
    }
  }, [tablePage, totalTablePages]);

  useEffect(() => {
    if (!selectedRowKey) {
      return;
    }

    const selectedIndex = tableRows.findIndex((row) => row.rowKey === selectedRowKey);
    if (selectedIndex < 0) {
      return;
    }

    const nextPage = Math.floor(selectedIndex / TREND_TABLE_PAGE_SIZE) + 1;
    if (nextPage !== tablePage) {
      setTablePage(nextPage);
    }
  }, [selectedRowKey, tablePage, tableRows]);

  const chartPointsBySeries = useMemo(() => {
    const denominator = Math.max(1, trendRows.length - 1);

    return Object.fromEntries(
      TREND_SERIES.map((series) => [
        series.key,
        trendRows.map((row, index) => {
          const value = row.values[series.key];
          const x =
            trendRows.length === 1
              ? CHART_MARGIN.left + PLOT_WIDTH / 2
              : CHART_MARGIN.left + (PLOT_WIDTH * index) / denominator;
          const y =
            value == null
              ? null
              : CHART_MARGIN.top + PLOT_HEIGHT - (Math.min(value, chartMax) / chartMax) * PLOT_HEIGHT;

          return {
            id: row.id,
            rowKey: row.rowKey,
            label: row.axisLabel,
            fullDate: row.dateLabel,
            value,
            x,
            y,
          };
        }),
      ]),
    );
  }, [chartMax, trendRows]);
  const selectionColumns = useMemo(() => {
    const xPoints = chartPointsBySeries.tdcg ?? [];

    return trendRows.map((row, index) => {
      const currentX = xPoints[index]?.x ?? CHART_MARGIN.left;
      const previousX = xPoints[index - 1]?.x;
      const nextX = xPoints[index + 1]?.x;
      const leftX = index === 0 ? CHART_MARGIN.left : (previousX + currentX) / 2;
      const rightX = index === trendRows.length - 1 ? CHART_WIDTH - CHART_MARGIN.right : (currentX + nextX) / 2;

      return {
        rowKey: row.rowKey,
        x: leftX,
        width: Math.max(18, rightX - leftX),
        centerX: currentX,
      };
    });
  }, [chartPointsBySeries.tdcg, trendRows]);

  const xTickStep = Math.max(1, Math.ceil(trendRows.length / 6));
  const selectedColumn = selectedRow ? selectionColumns.find((column) => column.rowKey === selectedRow.rowKey) ?? null : null;
  const selectedLabelX = selectedColumn?.centerX ?? null;
  const selectedLabelWidth = Math.max(108, (selectedRow?.dateLabel?.length ?? 10) * 7.5);
  const selectedLabelLeft =
    selectedLabelX == null
      ? null
      : Math.min(
          Math.max(selectedLabelX - selectedLabelWidth / 2, CHART_MARGIN.left),
          CHART_WIDTH - CHART_MARGIN.right - selectedLabelWidth,
        );

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] px-5 py-6 shadow-[var(--shadow-card)] lg:px-6">
      <style>
        {`
          @keyframes dgaTrendRowPulse {
            0%, 100% {
              background-color: ${palette.rowPulseStartBg};
              box-shadow: ${palette.rowPulseStartShadow};
            }
            50% {
              background-color: ${palette.rowPulseMidBg};
              box-shadow: ${palette.rowPulseMidShadow};
            }
          }

          @keyframes dgaTrendChartPulse {
            0%, 100% {
              opacity: 0.18;
            }
            50% {
              opacity: 0.34;
            }
          }
        `}
      </style>

      <div>
        <h2 className="text-[2rem] font-semibold text-[var(--foreground)]">DGA Trending</h2>
      </div>

      {!trendRows.length ? (
        <div
          className="mt-8 rounded-xl border border-dashed bg-[var(--card-muted)] px-6 py-10 text-center text-[16px] text-[var(--muted)]"
          style={{ borderColor: palette.emptyBorder, backgroundColor: isDarkMode ? palette.chartBg : undefined, color: palette.emptyText }}
        >
          Add dated gas results to display the dissolved gas trend chart and percent-change table.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card-muted)]">
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-[20px] font-semibold text-[var(--foreground)]">Dissolved Gas Trend Chart</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TREND_SERIES.map((series) => {
                    const isVisible = visibleSeries[series.key];

                    return (
                      <button
                        key={series.key}
                        type="button"
                        onClick={() =>
                          setVisibleSeries((current) => ({
                            ...current,
                            [series.key]: !current[series.key],
                          }))
                        }
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          isVisible ? "" : ""
                        }`}
                        style={{
                          borderColor: isVisible ? palette.legendActiveBorder : palette.legendInactiveBorder,
                          backgroundColor: isVisible ? palette.legendActiveBg : palette.legendInactiveBg,
                          color: isVisible ? palette.legendActiveText : palette.legendInactiveText,
                        }}
                      >
                        <span
                          className="h-2.5 w-6 rounded-full"
                          style={{
                            backgroundColor: series.color,
                            opacity: isVisible ? 1 : 0.35,
                            backgroundImage: series.dash
                              ? `linear-gradient(to right, ${series.color} 65%, transparent 65%)`
                              : undefined,
                            backgroundSize: series.dash ? "10px 100%" : undefined,
                          }}
                        />
                        <SeriesLabel series={series} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-3 py-4 sm:px-5">
              {visibleTrendSeries.length ? (
                <div className="h-[360px] w-full">
                  <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full w-full" role="img" aria-label="DGA trend chart">
                    <rect x="0" y="0" width={CHART_WIDTH} height={CHART_HEIGHT} fill={palette.chartBg} />

                    {yTicks.map((tickValue) => {
                      const y = CHART_MARGIN.top + PLOT_HEIGHT - (tickValue / chartMax) * PLOT_HEIGHT;

                      return (
                        <g key={`tick-${tickValue}`}>
                          <line
                            x1={CHART_MARGIN.left}
                            y1={y}
                            x2={CHART_WIDTH - CHART_MARGIN.right}
                            y2={y}
                            stroke={palette.chartGrid}
                            strokeDasharray="4 5"
                          />
                          <text
                            x={CHART_MARGIN.left - 12}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="12"
                            fill={palette.axisText}
                          >
                            {formatAxisValue(tickValue)}
                          </text>
                        </g>
                      );
                    })}

                    {selectedRow && selectedColumn ? (
                      <g pointerEvents="none">
                        <rect
                          x={selectedColumn.x}
                          y={CHART_MARGIN.top}
                          width={selectedColumn.width}
                          height={PLOT_HEIGHT}
                          fill={palette.selectedBand}
                          style={{ animation: "dgaTrendChartPulse 2.8s ease-in-out infinite" }}
                        />
                        <line
                          x1={selectedColumn.centerX}
                          y1={CHART_MARGIN.top}
                          x2={selectedColumn.centerX}
                          y2={CHART_HEIGHT - CHART_MARGIN.bottom}
                          stroke={palette.selectedLine}
                          strokeWidth="2"
                          strokeDasharray="6 6"
                        />
                        <g transform={`translate(${selectedLabelLeft}, ${CHART_MARGIN.top - 2})`}>
                          <rect
                            x="0"
                            y="0"
                            rx="10"
                            ry="10"
                            width={selectedLabelWidth}
                            height="28"
                            fill={palette.selectedLabelBg}
                            stroke={palette.selectedLabelStroke}
                          />
                          <text x={selectedLabelWidth / 2} y="18" textAnchor="middle" fontSize="12" fontWeight="700" fill={palette.selectedLabelText}>
                            {selectedRow.dateLabel}
                          </text>
                        </g>
                      </g>
                    ) : null}

                    <line
                      x1={CHART_MARGIN.left}
                      y1={CHART_HEIGHT - CHART_MARGIN.bottom}
                      x2={CHART_WIDTH - CHART_MARGIN.right}
                      y2={CHART_HEIGHT - CHART_MARGIN.bottom}
                      stroke={palette.axisLine}
                    />

                    {trendRows.map((row, index) => {
                      if (index % xTickStep !== 0 && index !== trendRows.length - 1) {
                        return null;
                      }

                      const point = chartPointsBySeries.tdcg[index];

                      return (
                        <text
                          key={`x-tick-${row.id}-${row.date}`}
                          x={point.x}
                          y={CHART_HEIGHT - 18}
                          textAnchor={index === 0 ? "start" : index === trendRows.length - 1 ? "end" : "middle"}
                          fontSize="12"
                          fill={palette.axisText}
                        >
                          {row.axisLabel}
                        </text>
                      );
                    })}

                    {selectionColumns.map((column) => (
                      <rect
                        key={`hit-${column.rowKey}`}
                        x={column.x}
                        y={CHART_MARGIN.top}
                        width={column.width}
                        height={PLOT_HEIGHT}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => setSelectedRowKey(column.rowKey)}
                      >
                        <title>{trendRows.find((row) => row.rowKey === column.rowKey)?.dateLabel ?? "Select sample"}</title>
                      </rect>
                    ))}

                    {visibleTrendSeries.map((series) => {
                      const points = chartPointsBySeries[series.key];
                      const path = buildLinePath(points);

                      return (
                        <g key={series.key}>
                          {path ? (
                            <path
                              d={path}
                              fill="none"
                              stroke={series.color}
                              strokeWidth={series.key === "tdcg" ? 3 : 2.5}
                              strokeDasharray={series.dash}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : null}
                          {points.map((point) =>
                            point.y == null ? null : (
                              <g key={`${series.key}-${point.id}-${point.fullDate}`} className="cursor-pointer" onClick={() => setSelectedRowKey(point.rowKey)}>
                                {point.rowKey === selectedRowKey ? (
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={series.key === "tdcg" ? 10 : 8}
                                    fill={series.color}
                                    opacity="0.18"
                                    style={{ animation: "dgaTrendChartPulse 2.8s ease-in-out infinite" }}
                                  />
                                ) : null}
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={point.rowKey === selectedRowKey ? (series.key === "tdcg" ? 6 : 5) : series.key === "tdcg" ? 4.5 : 3.5}
                                  fill={series.color}
                                  stroke={palette.pointStroke}
                                  strokeWidth="2"
                                >
                                  <title>{`${getSeriesLabelText(series)}: ${formatValue(point.value)} ppm on ${point.fullDate}`}</title>
                                </circle>
                              </g>
                            ),
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div
                  className="flex h-[360px] items-center justify-center rounded-lg border border-dashed bg-[var(--card)] px-6 text-center text-sm leading-6 text-[var(--muted)]"
                  style={{ borderColor: palette.emptyBorder, backgroundColor: palette.emptyBg, color: palette.emptyText }}
                >
                  Select at least one gas in the legend to display the chart.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card-muted)]">
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <h3 className="text-[20px] font-semibold text-[var(--foreground)]">Percent Trending Table</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em]" style={{ backgroundColor: palette.tableHeadBg, color: palette.tableHeadText }}>
                    <th className="sticky left-0 z-10 border-b px-3 py-3 font-semibold" style={{ borderColor: palette.sectionBorder, backgroundColor: palette.tableHeadBg }}>
                      Sample
                    </th>
                    {TREND_SERIES.map((series) => (
                      <th
                        key={`head-${series.key}`}
                        className="border-b px-2.5 py-3 text-center font-semibold"
                        style={{ borderColor: palette.sectionBorder, color: series.color }}
                      >
                        <SeriesLabel series={series} stacked />
                      </th>
                    ))}
                    {faultColumns.map((column) => (
                      <th
                        key={`fault-head-${column.key}`}
                        className="border-b px-2 py-2 text-center font-semibold"
                        style={{ borderColor: palette.sectionBorder, color: palette.tableHeadText }}
                      >
                        <FaultMethodIcon title={column.title} sides={column.sides} marker={column.marker} palette={palette} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedTrendRows.map((row, index) => {
                    const absoluteIndex = tableStartIndex + index;

                    return (
                    <tr key={`trend-row-${row.id}-${row.date}`}>
                      <td
                        className="sticky left-0 z-10 border-b border-[#e5e9ed] px-3 py-3 align-top"
                        style={{
                          ...getRowCellStyle(
                            row.rowKey === selectedRowKey,
                            absoluteIndex % 2 === 0 ? palette.tableRowEvenBg : palette.tableRowOddBg,
                            palette,
                            true,
                          ),
                          borderColor: palette.tableRowBorder,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRowKey(row.rowKey)}
                          className="w-full text-left focus:outline-none"
                        >
                          <div className="font-semibold" style={{ color: row.rowKey === selectedRowKey ? palette.selectedDateText : palette.strongText }}>
                            {row.dateLabel}
                          </div>
                          <div className="mt-1 text-xs" style={{ color: palette.axisText }}>Sample #{row.displayId ?? "-"}</div>
                        </button>
                      </td>
                      {TREND_SERIES.map((series) => (
                        <td
                          key={`cell-${row.id}-${series.key}`}
                          className="border-b border-[#e5e9ed] px-2.5 py-3 text-center align-top"
                          style={{
                            ...getRowCellStyle(
                              row.rowKey === selectedRowKey,
                              absoluteIndex % 2 === 0 ? palette.tableRowEvenBg : palette.tableRowOddBg,
                              palette,
                            ),
                            borderColor: palette.tableRowBorder,
                          }}
                        >
                          <div className="flex min-w-[68px] flex-col items-center gap-0.5">
                            <span className="text-[18px] font-semibold leading-none" style={{ color: series.key === "tdcg" ? palette.strongText : palette.numberText }}>
                              {formatValue(row.values[series.key])}
                            </span>
                            <TrendBadge trend={row.trends[series.key]} mutedText={palette.mutedText} />
                          </div>
                        </td>
                      ))}
                      {faultColumns.map((column) => (
                        <td
                          key={`fault-cell-${row.id}-${column.key}`}
                          className="border-b border-[#e5e9ed] px-2 py-3 text-center align-middle"
                          style={{
                            ...getRowCellStyle(
                              row.rowKey === selectedRowKey,
                              absoluteIndex % 2 === 0 ? palette.tableRowEvenBg : palette.tableRowOddBg,
                              palette,
                            ),
                            borderColor: palette.tableRowBorder,
                          }}
                        >
                          <FaultZoneBadge value={row.faults?.[column.key]} palette={palette} />
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"
              style={{ borderColor: palette.sectionBorder }}
            >
              <p className="text-xs font-medium" style={{ color: palette.axisText }}>
                Showing {tableRows.length ? tableStartIndex + 1 : 0}-{tableStartIndex + pagedTrendRows.length} of {tableRows.length} samples
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTablePage((current) => Math.max(1, current - 1))}
                  disabled={tablePage <= 1}
                  className="rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: palette.sectionBorder,
                    color: palette.numberText,
                    backgroundColor: palette.tableRowEvenBg,
                  }}
                >
                  Prev
                </button>
                {Array.from({ length: totalTablePages }, (_, index) => index + 1).map((pageNumber) => {
                  const isActive = pageNumber === tablePage;

                  return (
                    <button
                      key={`trend-page-${pageNumber}`}
                      type="button"
                      onClick={() => setTablePage(pageNumber)}
                      className="min-w-[30px] rounded-md border px-2.5 py-1 text-xs font-semibold transition"
                      style={{
                        borderColor: isActive ? palette.selectedLine : palette.sectionBorder,
                        color: isActive ? palette.selectedLabelText : palette.numberText,
                        backgroundColor: isActive ? palette.selectedLabelBg : palette.tableRowEvenBg,
                      }}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setTablePage((current) => Math.min(totalTablePages, current + 1))}
                  disabled={tablePage >= totalTablePages}
                  className="rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: palette.sectionBorder,
                    color: palette.numberText,
                    backgroundColor: palette.tableRowEvenBg,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
