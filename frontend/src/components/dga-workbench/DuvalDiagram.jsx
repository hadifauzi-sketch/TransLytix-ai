import {
  PENTAGON_DEFINITIONS,
  TRIANGLE_DEFINITIONS,
  getPentagonLabelPoints,
  getPentagonMarker,
  getPentagonOuterPath,
  getPentagonPaths,
  getTriangleMarker,
  getTriangleOuterPath,
  getTrianglePaths,
} from "../../lib/dga/duvalGeometry.js";
import {
  getHeptagonDiagramPath,
  getHeptagonLabelPoints,
  getHeptagonViewBox,
  getHeptagonZoneLabels,
} from "../../lib/dga/heptagonGeometry.js";

function isDarkThemeActive() {
  if (typeof document === "undefined") {
    return true;
  }

  if (document.documentElement.classList.contains("dark")) {
    return true;
  }

  const workbench = document.querySelector("[data-dga-workbench]");
  const colorMode = workbench?.getAttribute("data-color-mode");
  if (colorMode === "dark" || colorMode === "light") {
    return colorMode === "dark";
  }

  const background = workbench
    ? getComputedStyle(workbench).getPropertyValue("--background").trim()
    : "";

  if (!background) {
    return false;
  }

  const rgbMatch = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b) < 140;
  }

  const hex = background.replace("#", "");
  if (hex.length === 3 || hex.length === 6) {
    const fullHex = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex;
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b) < 140;
  }

  return false;
}

const SAMPLE_COLOR = "#ff6a2a";
const SAMPLE_OUTLINE = "#163042";
const ACTIVE_STROKE = "#101719";
const DISABLED_STROKE = "#b5b5b5";
const DISABLED_TEXT = "#adb5bd";
const ACTIVE_TEXT = "#101719";
const ACTIVE_ZONE_FILL = "#a8d8aa";
const HEPTAGON_CENTER = [342.4, 381];
const HEPTAGON_REQUIRED_KEYS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2"];
const TRIANGLE_VERTICES = {
  top: [210, 18],
  left: [60, 278],
  right: [360, 278],
};
const TRIANGLE_LABEL_NUDGES = {
  triangle1: {
    PD: [18, -2],
    T1: [16, -8],
    T2: [16, -4],
    T3: [8, 4],
    D1: [-10, 10],
    D2: [0, 12],
    DT: [8, 12],
  },
  triangle3_soybean: {
    PD: [18, -2],
    T1: [16, -8],
    T2: [16, -4],
    T3: [8, 4],
    D1: [-10, 10],
    D2: [0, 12],
    DT: [8, 12],
  },
  triangle3_rapeseed: {
    PD: [18, -2],
    T1: [16, -8],
    T2: [16, -4],
    T3: [8, 4],
    D1: [-10, 10],
    D2: [0, 12],
    DT: [8, 12],
  },
  triangle3_sunflower: {
    PD: [18, -2],
    T1: [16, -8],
    T2: [16, -4],
    T3: [8, 4],
    D1: [-10, 10],
    D2: [0, 12],
    DT: [8, 12],
  },
  triangle3_synthetic: {
    PD: [18, -2],
    T1: [16, -8],
    T2: [16, -4],
    T3: [8, 4],
    D1: [-10, 10],
    D2: [0, 12],
    DT: [8, 12],
  },
  triangle4: {
    PD: [10, -6],
    S: [0, -8],
    C: [8, 0],
    O: [-10, 2],
    ND: [-6, 2],
  },
  triangle5: {
    PD: [10, -6],
    S: [0, -8],
    O: [-10, 2],
    "T2-H": [8, -2],
    "T3-H": [10, 2],
    C: [0, 4],
    ND: [-6, 6],
  },
  triangle6: {
    PD: [10, -6],
    S: [0, -8],
    O: [-10, 2],
    C: [8, 2],
    ND: [0, 2],
  },
};

function getDiagramClassName(size) {
  return size === "modal"
    ? "w-full max-w-[720px] overflow-visible"
    : "w-full max-w-[360px] overflow-visible";
}

function hasHeptagonData(raw) {
  return HEPTAGON_REQUIRED_KEYS.every((key) => raw?.[key] != null);
}

function pushPointAwayFromCenter(point, distance) {
  const xOffset = point[0] - HEPTAGON_CENTER[0];
  const yOffset = point[1] - HEPTAGON_CENTER[1];
  const length = Math.hypot(xOffset, yOffset) || 1;

  return [point[0] + (xOffset / length) * distance, point[1] + (yOffset / length) * distance];
}

function trianglePointFromPercentages(a, b, c) {
  const topWeight = a / 100;
  const leftWeight = b / 100;
  const rightWeight = c / 100;

  return [
    TRIANGLE_VERTICES.top[0] * topWeight +
      TRIANGLE_VERTICES.left[0] * leftWeight +
      TRIANGLE_VERTICES.right[0] * rightWeight,
    TRIANGLE_VERTICES.top[1] * topWeight +
      TRIANGLE_VERTICES.left[1] * leftWeight +
      TRIANGLE_VERTICES.right[1] * rightWeight,
  ];
}

function trianglePolygonToPoints(polygon) {
  return polygon.a.map((value, index) => trianglePointFromPercentages(value, polygon.b[index], polygon.c[index]));
}

function getPolygonCentroid(points) {
  let signedAreaTwice = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    signedAreaTwice += cross;
    centroidX += (current[0] + next[0]) * cross;
    centroidY += (current[1] + next[1]) * cross;
  }

  if (Math.abs(signedAreaTwice) < 1e-6) {
    const [totalX, totalY] = points.reduce(
      (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1]],
      [0, 0],
    );

    return [totalX / points.length, totalY / points.length];
  }

  return [centroidX / (3 * signedAreaTwice), centroidY / (3 * signedAreaTwice)];
}

function getTrianglePolygonEntries(diagramKey) {
  const polygons = TRIANGLE_DEFINITIONS[diagramKey]?.polygons ?? {};

  return Object.entries(polygons).flatMap(([zone, polygon]) =>
    (Array.isArray(polygon) ? polygon : [polygon]).map((segment, index) => ({
      key: `${zone}-${index}`,
      zone,
      polygon: segment,
    })),
  );
}

function getTriangleLabelPositions(diagramKey) {
  const definition = TRIANGLE_DEFINITIONS[diagramKey];
  if (!definition) {
    return [];
  }

  if (Array.isArray(definition.labelPositions)) {
    return definition.labelPositions.map((label, index) => ({
      key: `${label.zone}-${index}`,
      ...label,
    }));
  }

  const nudges = TRIANGLE_LABEL_NUDGES[diagramKey] ?? {};

  return getTrianglePolygonEntries(diagramKey).map(({ key, zone, polygon }) => {
      const centroid = getPolygonCentroid(trianglePolygonToPoints(polygon));
      const nudge = nudges[zone] ?? [0, 0];
      return {
        key,
        zone,
        point: [centroid[0] + nudge[0], centroid[1] + nudge[1]],
      };
    });
}

function ChemicalFormula({ formula, x, y, fill, fontSize, fontWeight, textAnchor, dominantBaseline }) {
  const parts = [];
  let i = 0;
  while (i < formula.length) {
    if (/[A-Za-z]/.test(formula[i])) {
      let text = formula[i];
      i++;
      while (i < formula.length && /[a-z]/.test(formula[i])) {
        text += formula[i];
        i++;
      }
      parts.push({ text, sub: false });
    } else if (/[0-9]/.test(formula[i])) {
      parts.push({ text: formula[i], sub: true });
      i++;
    } else {
      i++;
    }
  }

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
    >
      {parts.map((part, idx) =>
        part.sub ? (
          <tspan key={idx} baselineShift="sub" fontSize="0.75em">
            {part.text}
          </tspan>
        ) : (
          <tspan key={idx}>{part.text}</tspan>
        ),
      )}
    </text>
  );
}

function SampleMarkers({ points, latestId, selectedId = null, disabled, markerScale = 1, onSelectSample = null }) {
  if (disabled) {
    return null;
  }

  const r = 5 * markerScale;
  const half = 6 * markerScale;
  const size = 12 * markerScale;
  const sw = 2.2 * markerScale;
  const hitRadius = Math.max(11 * markerScale, r + 6);

  const handleKeyDown = (event, sampleId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectSample?.(sampleId);
    }
  };

  return (
    <g>
      {points.map((item) => {
        const isLatest = item.id === latestId;
        const isSelected = item.id === selectedId;

        return (
          <g
            key={item.id}
            onClick={() => onSelectSample?.(item.id)}
            onKeyDown={(event) => handleKeyDown(event, item.id)}
            className={onSelectSample ? "cursor-pointer" : undefined}
            role={onSelectSample ? "button" : undefined}
            tabIndex={onSelectSample ? 0 : undefined}
            aria-label={onSelectSample ? `Inspect sample ${item.id}` : undefined}
          >
            <circle cx={item.point[0]} cy={item.point[1]} r={hitRadius} fill="transparent" />
            {!isLatest ? (
              <>
                {isSelected ? (
                  <circle
                    cx={item.point[0]}
                    cy={item.point[1]}
                    r={r + 4.5 * markerScale}
                    fill="none"
                    stroke={SAMPLE_OUTLINE}
                    strokeWidth={1.6 * markerScale}
                  />
                ) : null}
                <circle
                  cx={item.point[0]}
                  cy={item.point[1]}
                  r={r}
                  fill={isSelected ? "#fff3ed" : "#ffffff"}
                  stroke={SAMPLE_COLOR}
                  strokeWidth={sw}
                />
              </>
            ) : (
              <>
                {isSelected ? (
                  <rect
                    x={item.point[0] - (half + 4 * markerScale)}
                    y={item.point[1] - (half + 4 * markerScale)}
                    width={size + 8 * markerScale}
                    height={size + 8 * markerScale}
                    fill="none"
                    stroke={SAMPLE_OUTLINE}
                    strokeWidth={1.6 * markerScale}
                    transform={`rotate(45 ${item.point[0]} ${item.point[1]})`}
                  />
                ) : null}
                <rect
                  x={item.point[0] - half}
                  y={item.point[1] - half}
                  width={size}
                  height={size}
                  fill={SAMPLE_COLOR}
                  stroke={SAMPLE_OUTLINE}
                  strokeWidth={1.8 * markerScale}
                  transform={`rotate(45 ${item.point[0]} ${item.point[1]})`}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function ActiveZoneFill({ paths, disabled }) {
  if (!paths?.length || disabled) {
    return null;
  }

  return (
    <g>
      {paths.map((path, index) => (
        <path key={`active-${index}`} d={path} fill={ACTIVE_ZONE_FILL} fillOpacity="0.92" stroke="none" />
      ))}
    </g>
  );
}

function TriangleAxes({ axes, disabled }) {
  const color = disabled ? DISABLED_TEXT : isDarkThemeActive() ? "#ffffff" : ACTIVE_TEXT;

  return (
    <g fill={color} fontSize="11" fontFamily="inherit">
      <text x="88" y="194" transform="rotate(-61 88 194)">{`${axes.left} ↗`}</text>
      <text x="210" y="310" textAnchor="middle">{`←${axes.bottom}`}</text>
      <text x="303" y="142" textAnchor="middle" transform="rotate(61 303 142)">
        {`${axes.right} →`}
      </text>
    </g>
  );
}

function TriangleLabels({ diagramKey, currentZone, disabled }) {
  const color = disabled ? DISABLED_TEXT : isDarkThemeActive() ? "#ffffff" : ACTIVE_TEXT;
  const labels = getTriangleLabelPositions(diagramKey);

  return labels.map((label, index) => (
    <text
      key={label.key ?? `${label.zone}-${index}`}
      x={label.point[0]}
      y={label.point[1]}
      fill={color}
      fontSize="11.5"
      fontWeight={label.zone === currentZone && !disabled ? "700" : "600"}
      textAnchor="middle"
      dominantBaseline="middle"
      paintOrder="stroke"
      stroke={disabled ? "transparent" : isDarkThemeActive() ? "#0c1b24" : "#ffffff"}
      strokeWidth="2.4"
      strokeLinejoin="round"
    >
      {label.zone}
    </text>
  ));
}

function TriangleDiagram({ diagramKey, currentZone, completedSamples, latestId, selectedId, disabled, size, onSelectSample }) {
  const color = disabled ? DISABLED_STROKE : isDarkThemeActive() ? "#ffffff" : ACTIVE_STROKE;
  const paths = getTrianglePaths(diagramKey);
  const activePaths = paths.filter((item) => item.zone === currentZone).map((item) => item.path);
  const points = completedSamples
    .map((sample) => ({
      id: sample.id,
      point: getTriangleMarker(diagramKey, sample.analysis.raw),
    }))
    .filter((item) => item.point && item.point.every((value) => Number.isFinite(value)));

  return (
    <svg viewBox="0 0 420 320" className={getDiagramClassName(size)}>
      <ActiveZoneFill paths={activePaths} disabled={disabled} />
      <path d={getTriangleOuterPath()} fill="none" stroke={color} strokeWidth="2.2" />
      {paths.map((item, index) => (
        <path
          key={`${item.zone}-${index}`}
          d={item.path}
          fill="none"
          stroke={color}
          strokeWidth={item.zone === currentZone && !disabled ? "1.9" : "1.35"}
        />
      ))}
      <TriangleLabels diagramKey={diagramKey} currentZone={currentZone} disabled={disabled} />
      <TriangleAxes axes={TRIANGLE_DEFINITIONS[diagramKey].axes} disabled={disabled} />
      <SampleMarkers
        points={points}
        latestId={latestId}
        selectedId={selectedId}
        disabled={disabled}
        onSelectSample={onSelectSample}
      />
    </svg>
  );
}

function PentagonDiagram({ oilType, currentZone, completedSamples, latestId, selectedId, disabled, size, onSelectSample }) {
  const isDarkTheme = isDarkThemeActive();
  const color = disabled ? DISABLED_STROKE : isDarkTheme ? "#ffffff" : ACTIVE_STROKE;
  const paths = getPentagonPaths(oilType);
  const activePaths = paths.filter((item) => item.zone === currentZone).map((item) => item.path);
  const points = completedSamples
    .map((sample) => ({
      id: sample.id,
      point: getPentagonMarker(sample.analysis.raw),
    }))
    .filter((item) => item.point && item.point.every((value) => Number.isFinite(value)));

  return (
    <svg viewBox="0 0 420 320" className={getDiagramClassName(size)}>
      <ActiveZoneFill paths={activePaths} disabled={disabled} />
      <path d={getPentagonOuterPath()} fill="none" stroke={color} strokeWidth="2.2" />
      {paths.map((item, index) => (
        <path
          key={`${item.zone}-${index}`}
          d={item.path}
          fill="none"
          stroke={color}
          strokeWidth={item.zone === currentZone && !disabled ? "1.9" : "1.35"}
        />
      ))}
      {getPentagonLabelPoints(oilType).map((label) => (
        <text
          key={label.zone}
          x={label.point[0]}
          y={label.point[1]}
          fill={disabled ? DISABLED_TEXT : isDarkTheme ? "#ffffff" : ACTIVE_TEXT}
          fontSize="11"
          fontWeight={label.zone === currentZone && !disabled ? "700" : "600"}
          textAnchor="middle"
        >
          {label.zone}
        </text>
      ))}
      <SampleMarkers
        points={points}
        latestId={latestId}
        selectedId={selectedId}
        disabled={disabled}
        onSelectSample={onSelectSample}
      />
    </svg>
  );
}

function HeptagonDiagram({ currentZone, completedSamples, latestId, selectedId, disabled, size, onSelectSample }) {
  const isDarkTheme = isDarkThemeActive();
  const color = disabled ? DISABLED_STROKE : isDarkTheme ? "#ffffff" : ACTIVE_STROKE;
  const labelColor = disabled ? DISABLED_TEXT : isDarkTheme ? "#ffffff" : ACTIVE_TEXT;
  const points = completedSamples
    .filter((sample) => hasHeptagonData(sample.analysis.raw))
    .map((sample) => ({
      id: sample.id,
      point: sample.analysis.heptagon?.point ?? null,
    }))
    .filter((item) => item.point && item.point.every((value) => Number.isFinite(value)));

  return (
    <svg viewBox={getHeptagonViewBox()} className={getDiagramClassName(size)}>
      <path
        d={getHeptagonDiagramPath()}
        fill={color}
        stroke="none"
        opacity={disabled ? 0.35 : 1}
      />
      {getHeptagonZoneLabels().map((label) => (
        <text
          key={label.zone}
          x={label.point[0]}
          y={label.point[1]}
          fill={labelColor}
          fontSize="24"
          fontWeight={label.zone === currentZone && !disabled ? "700" : "600"}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label.zone}
        </text>
      ))}
      {getHeptagonLabelPoints().map((label) => {
        const basePosition = pushPointAwayFromCenter(label.point, label.radialOffset ?? 0);
        const position = [
          basePosition[0] + (label.nudge?.[0] ?? 0),
          basePosition[1] + (label.nudge?.[1] ?? 0),
        ];
        const xOffset = position[0] - HEPTAGON_CENTER[0];
        const textAnchor =
          label.textAnchor ?? (Math.abs(xOffset) < 10 ? "middle" : xOffset < 0 ? "end" : "start");

        return (
          <ChemicalFormula
            key={label.label}
            formula={label.label}
            x={position[0]}
            y={position[1]}
            fill={labelColor}
            fontSize="32"
            fontWeight="700"
            textAnchor={textAnchor}
            dominantBaseline="middle"
          />
        );
      })}
      <SampleMarkers
        points={points}
        latestId={latestId}
        selectedId={selectedId}
        disabled={disabled}
        markerScale={2.5}
        onSelectSample={onSelectSample}
      />
    </svg>
  );
}

export function FaultZoneLegend() {
  return (
    <div className="flex flex-wrap items-center gap-8 text-[17px] text-[var(--foreground)]">
      <div className="flex items-center gap-2.5">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-[#ff6a2a] bg-[var(--card)]" />
        <span>Samples</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="relative h-3.5 w-3.5 rotate-45 border-2 border-[var(--foreground)] bg-[#ff6a2a]" />
        <span>Latest sample</span>
      </div>
    </div>
  );
}

export function DuvalDiagram({
  type,
  diagramKey,
  oilType,
  currentZone,
  completedSamples,
  latestId,
  selectedId = null,
  disabled = false,
  size = "default",
  onSelectSample = null,
}) {
  if (type === "heptagon") {
    return (
      <HeptagonDiagram
        currentZone={currentZone}
        completedSamples={completedSamples}
        latestId={latestId}
        selectedId={selectedId}
        disabled={disabled}
        size={size}
        onSelectSample={onSelectSample}
      />
    );
  }

  if (type === "pentagon") {
    return (
      <PentagonDiagram
        oilType={oilType}
        currentZone={currentZone}
        completedSamples={completedSamples}
        latestId={latestId}
        selectedId={selectedId}
        disabled={disabled}
        size={size}
        onSelectSample={onSelectSample}
      />
    );
  }

  return (
    <TriangleDiagram
      diagramKey={diagramKey}
      currentZone={currentZone}
      completedSamples={completedSamples}
      latestId={latestId}
      selectedId={selectedId}
      disabled={disabled}
      size={size}
      onSelectSample={onSelectSample}
    />
  );
}

export function getDiagramTitle(type, diagramKey, oilType) {
  if (type === "heptagon") {
    return "Heptagon";
  }

  if (type === "pentagon") {
    return PENTAGON_DEFINITIONS[oilType]?.title ?? "Pentagon";
  }

  return TRIANGLE_DEFINITIONS[diagramKey]?.title ?? diagramKey;
}
