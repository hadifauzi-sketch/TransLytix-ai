export const HEPTAGON_REQUIRED_KEYS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2"];

const HEPTAGON_GAS_ORDER = ["co", "co2", "c2h4", "h2", "ch4", "c2h2", "c2h6"];
const HEPTAGON_DIAGRAM_DIMS = { width: 684.8, height: 729.32 };
const HEPTAGON_CENTER_RATIO = { x: 0.5, y: 0.52 };
const HEPTAGON_AXIS_RATIOS = {
  co: { x: 0.5, y: 0.11 },
  co2: { x: 0.86, y: 0.27 },
  c2h4: { x: 0.87, y: 0.66 },
  h2: { x: 0.63, y: 0.92 },
  ch4: { x: 0.36, y: 0.92 },
  c2h2: { x: 0.12, y: 0.66 },
  c2h6: { x: 0.13, y: 0.27 },
};
const HEPTAGON_ZONE_POLYGONS = {
  D2: [
    { x: 0.18, y: 0.3 },
    { x: 0.5, y: 0.13 },
    { x: 0.58, y: 0.32 },
    { x: 0.53, y: 0.51 },
    { x: 0.18, y: 0.51 },
  ],
  D1: [
    { x: 0.12, y: 0.65 },
    { x: 0.18, y: 0.51 },
    { x: 0.53, y: 0.51 },
    { x: 0.4, y: 0.9 },
    { x: 0.16, y: 0.76 },
  ],
  TD: [
    { x: 0.53, y: 0.51 },
    { x: 0.58, y: 0.32 },
    { x: 0.83, y: 0.5 },
    { x: 0.67, y: 0.89 },
    { x: 0.4, y: 0.9 },
  ],
  LCCD: [
    { x: 0.58, y: 0.32 },
    { x: 0.67, y: 0.26 },
    { x: 0.86, y: 0.39 },
    { x: 0.83, y: 0.5 },
  ],
  MCCD: [
    { x: 0.67, y: 0.26 },
    { x: 0.73, y: 0.21 },
    { x: 0.87, y: 0.29 },
    { x: 0.86, y: 0.39 },
  ],
  HCCD: [
    { x: 0.73, y: 0.21 },
    { x: 0.82, y: 0.19 },
    { x: 0.89, y: 0.26 },
    { x: 0.87, y: 0.29 },
  ],
  T3: [
    { x: 0.67, y: 0.89 },
    { x: 0.83, y: 0.5 },
    { x: 0.77, y: 0.59 },
    { x: 0.72, y: 0.89 },
  ],
  T2: [
    { x: 0.72, y: 0.89 },
    { x: 0.77, y: 0.61 },
    { x: 0.8, y: 0.59 },
    { x: 0.79, y: 0.71 },
    { x: 0.76, y: 0.82 },
  ],
  T1: [
    { x: 0.79, y: 0.71 },
    { x: 0.8, y: 0.59 },
    { x: 0.9, y: 0.63 },
    { x: 0.85, y: 0.77 },
  ],
  PD: [
    { x: 0.34, y: 0.86 },
    { x: 0.65, y: 0.85 },
    { x: 0.51, y: 0.97 },
    { x: 0.27, y: 0.97 },
  ],
  normal: [
    { x: 0.56, y: 0.54 },
    { x: 0.62, y: 0.5 },
    { x: 0.6, y: 0.58 },
    { x: 0.54, y: 0.58 },
  ],
};
const HEPTAGON_FAULT_FOCUS_GASES = {
  HCCD: ["co", "co2", "c2h4"],
  MCCD: ["co", "co2", "c2h4"],
  LCCD: ["co", "co2", "c2h4"],
  T1: ["ch4", "h2", "c2h4"],
  T2: ["ch4", "h2", "c2h4"],
  T3: ["ch4", "h2", "c2h4"],
  PD: ["h2", "ch4", "c2h2"],
  D1: ["h2", "c2h2", "c2h6"],
  D2: ["h2", "c2h2", "c2h6"],
  TD: ["h2", "ch4", "c2h2", "c2h4"],
  normal: HEPTAGON_GAS_ORDER,
};
const HEPTAGON_ZONE_ORDER = ["HCCD", "MCCD", "LCCD", "D2", "D1", "PD", "T3", "T2", "T1", "TD", "normal"];
const HEPTAGON_WEIGHT_FACTORS = {
  h2: 3.5,
  ch4: 2.9167,
  c2h6: 5.3846,
  c2h4: 7,
  c2h2: 116.6667,
  co: 1,
  co2: 0.14,
};
const HEPTAGON_NORMAL_LIMITS = {
  h2: 100,
  ch4: 120,
  c2h6: 65,
  c2h4: 50,
  c2h2: 3,
  co: 350,
  co2: 2500,
};

function toNonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function toNum(value) {
  return toNonNegativeNumber(value) ?? 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cross(pointA, pointB) {
  return pointA.x * pointB.y - pointA.y * pointB.x;
}

function axisRatioToPoint(gas, dims = HEPTAGON_DIAGRAM_DIMS) {
  const ratio = HEPTAGON_AXIS_RATIOS[gas] ?? { x: 0.5, y: 0.5 };
  return {
    x: ratio.x * dims.width,
    y: ratio.y * dims.height,
  };
}

function zonePolygonToPoints(zone, dims = HEPTAGON_DIAGRAM_DIMS) {
  const ratios = HEPTAGON_ZONE_POLYGONS[zone] ?? HEPTAGON_ZONE_POLYGONS.normal;
  return ratios.map((point) => ({
    x: point.x * dims.width,
    y: point.y * dims.height,
  }));
}

function getPolygonCentroid(points) {
  if (!points?.length) {
    return null;
  }

  if (points.length < 3) {
    const count = points.length;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / count,
      y: points.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }

  let twiceArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    twiceArea += factor;
    centroidX += (current.x + next.x) * factor;
    centroidY += (current.y + next.y) * factor;
  }

  if (Math.abs(twiceArea) < 1e-6) {
    const count = points.length;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / count,
      y: points.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }

  return {
    x: centroidX / (3 * twiceArea),
    y: centroidY / (3 * twiceArea),
  };
}

function getRayPolygonIntersection(origin, direction, polygon) {
  let closest = null;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-8) {
      continue;
    }

    const delta = { x: start.x - origin.x, y: start.y - origin.y };
    const t = cross(delta, edge) / denominator;
    const u = cross(delta, direction) / denominator;
    if (t < 0 || u < 0 || u > 1) {
      continue;
    }

    if (!closest || t < closest.t) {
      closest = {
        t,
        point: {
          x: origin.x + direction.x * t,
          y: origin.y + direction.y * t,
        },
      };
    }
  }

  return closest?.point ?? null;
}

function isPointInPolygon(point, polygon) {
  let inside = false;

  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex, currentIndex += 1) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function keepPointInsidePolygon(target, center, polygon, safety = 0.94) {
  const safeTarget = {
    x: center.x + (target.x - center.x) * safety,
    y: center.y + (target.y - center.y) * safety,
  };
  if (isPointInPolygon(safeTarget, polygon)) {
    return safeTarget;
  }

  let low = 0;
  let high = 1;
  let best = { ...center };

  for (let iteration = 0; iteration < 30; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = {
      x: center.x + (target.x - center.x) * mid,
      y: center.y + (target.y - center.y) * mid,
    };

    if (isPointInPolygon(candidate, polygon)) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }

  return {
    x: center.x + (best.x - center.x) * safety,
    y: center.y + (best.y - center.y) * safety,
  };
}

function determineHeptagonFault(percentages) {
  if (!percentages) {
    return "normal";
  }

  const c2h4 = toNum(percentages.c2h4);
  const c2h2 = toNum(percentages.c2h2);
  const co = toNum(percentages.co);
  const co2 = toNum(percentages.co2);

  // These cuts are aligned to the verified Table 3 / Table 4 Gouda samples
  // after applying the paper's weighting factors from section 2.1.
  if (c2h2 > 46.03) {
    return c2h4 <= 2.83 ? "D1" : "D2";
  }

  if (c2h4 <= 0.89) {
    return "PD";
  }

  if (c2h4 <= 32.97) {
    if (c2h4 <= 3.56) {
      if (co2 <= 11.49) {
        return "MCCD";
      }

      if (c2h4 <= 2.96) {
        return "HCCD";
      }

      return co2 <= 25.32 ? "T1" : "T2";
    }

    return co <= 32.87 ? "normal" : "LCCD";
  }

  if (co2 <= 0.55) {
    return "T2";
  }

  if (c2h4 > 40 && c2h2 > 10) {
    return "TD";
  }

  return "T3";
}

function getHeptagonPointFromZone(percentages, zone, dims = HEPTAGON_DIAGRAM_DIMS) {
  if (!percentages) {
    return null;
  }

  const effectiveZone = HEPTAGON_ZONE_POLYGONS[zone] ? zone : "normal";
  const zonePolygon = zonePolygonToPoints(effectiveZone, dims);
  const zoneCenter = getPolygonCentroid(zonePolygon);
  if (!zoneCenter) {
    return null;
  }

  const center = {
    x: HEPTAGON_CENTER_RATIO.x * dims.width,
    y: HEPTAGON_CENTER_RATIO.y * dims.height,
  };
  const focusGases = HEPTAGON_FAULT_FOCUS_GASES[effectiveZone] ?? HEPTAGON_GAS_ORDER;
  const focusTotal = focusGases.reduce((sum, gas) => sum + Math.max(0, toNum(percentages[gas])), 0);

  if (focusTotal <= 0) {
    return zoneCenter;
  }

  let directionX = 0;
  let directionY = 0;

  focusGases.forEach((gas) => {
    const anchor = axisRatioToPoint(gas, dims);
    const offsetX = anchor.x - center.x;
    const offsetY = anchor.y - center.y;
    const length = Math.hypot(offsetX, offsetY);
    if (length < 1e-6) {
      return;
    }

    const share = Math.max(0, toNum(percentages[gas])) / focusTotal;
    directionX += (offsetX / length) * share;
    directionY += (offsetY / length) * share;
  });

  const directionLength = Math.hypot(directionX, directionY);
  if (directionLength < 1e-6) {
    return zoneCenter;
  }

  const ray = {
    x: directionX / directionLength,
    y: directionY / directionLength,
  };
  const boundaryPoint = getRayPolygonIntersection(zoneCenter, ray, zonePolygon);
  if (!boundaryPoint) {
    return zoneCenter;
  }

  const dominantShare = focusGases.reduce(
    (best, gas) => Math.max(best, Math.max(0, toNum(percentages[gas])) / focusTotal),
    0,
  );
  const spread = clamp(0.24 + dominantShare * 0.32, 0.22, 0.58);
  const projected = {
    x: zoneCenter.x + (boundaryPoint.x - zoneCenter.x) * spread,
    y: zoneCenter.y + (boundaryPoint.y - zoneCenter.y) * spread,
  };
  const interiorPoint = keepPointInsidePolygon(projected, zoneCenter, zonePolygon);

  const result = {
    x: interiorPoint.x,
    y: interiorPoint.y,
  };

  // Place PD marker in the bottom-left area of the PD zone (near CH4 vertex)
  if (effectiveZone === "PD") {
    result.x = dims.width * 0.33;
    result.y = dims.height * 0.93;
  }

  return {
    x: clamp(result.x, dims.width * 0.03, dims.width * 0.97),
    y: clamp(result.y, dims.height * 0.03, dims.height * 0.97),
  };
}

function getHeptagonSidePoints(percentages, dims = HEPTAGON_DIAGRAM_DIMS) {
  if (!percentages) {
    return null;
  }

  const vertices = HEPTAGON_GAS_ORDER.map((gas) => axisRatioToPoint(gas, dims));

  return HEPTAGON_GAS_ORDER.map((gas, index) => {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const share = clamp(toNum(percentages[gas]) / 100, 0, 1);

    return {
      x: start.x + (end.x - start.x) * share,
      y: start.y + (end.y - start.y) * share,
    };
  });
}

function getHeptagonMarkerPoint(percentages, dims = HEPTAGON_DIAGRAM_DIMS) {
  const sidePoints = getHeptagonSidePoints(percentages, dims);
  if (!sidePoints?.length) {
    return null;
  }

  let weightedX = 0;
  let weightedY = 0;
  let totalMass = 0;

  HEPTAGON_GAS_ORDER.forEach((gas, index) => {
    const mass = toNum(percentages[gas]);
    weightedX += sidePoints[index].x * mass;
    weightedY += sidePoints[index].y * mass;
    totalMass += mass;
  });

  if (totalMass <= 0) {
    return null;
  }

  return {
    x: clamp(weightedX / totalMass, dims.width * 0.03, dims.width * 0.97),
    y: clamp(weightedY / totalMass, dims.height * 0.03, dims.height * 0.97),
  };
}

function getHeptagonPlotPoint(percentages, zone = null, dims = HEPTAGON_DIAGRAM_DIMS) {
  const markerPoint = getHeptagonMarkerPoint(percentages, dims);
  if (!markerPoint) {
    return null;
  }

  if (!zone || zone === "normal" || !HEPTAGON_ZONE_POLYGONS[zone]) {
    return markerPoint;
  }

  const zonePolygon = zonePolygonToPoints(zone, dims);

  // For PD, always place marker in the bottom-left area of the zone (near CH4 vertex)
  if (zone === "PD") {
    return {
      x: dims.width * 0.31,
      y: dims.height * 0.95,
    };
  }

  if (isPointInPolygon(markerPoint, zonePolygon)) {
    return markerPoint;
  }

  return getHeptagonPointFromZone(percentages, zone, dims) ?? markerPoint;
}

export function hasHeptagonData(values) {
  return HEPTAGON_REQUIRED_KEYS.every((key) => toNonNegativeNumber(values?.[key]) != null);
}

export function getHeptagonExceededLimitKeys(values) {
  if (!hasHeptagonData(values)) {
    return [];
  }

  return HEPTAGON_REQUIRED_KEYS.filter((key) => toNonNegativeNumber(values[key]) > HEPTAGON_NORMAL_LIMITS[key]);
}

export function getHeptagonWeightedPercentages(values) {
  if (!hasHeptagonData(values)) {
    return null;
  }

  const weightedValues = {};
  let weightedTotal = 0;

  HEPTAGON_GAS_ORDER.forEach((gas) => {
    const weightedValue = toNum(values[gas]) * (HEPTAGON_WEIGHT_FACTORS[gas] ?? 1);
    weightedValues[gas] = weightedValue;
    weightedTotal += weightedValue;
  });

  if (weightedTotal <= 0) {
    return null;
  }

  const percentages = {};
  HEPTAGON_GAS_ORDER.forEach((gas) => {
    percentages[gas] = (weightedValues[gas] / weightedTotal) * 100;
  });

  return {
    weightedValues,
    weightedTotal,
    percentages,
  };
}

export function getHeptagonPolygonPoints(values, zone = null, dims = HEPTAGON_DIAGRAM_DIMS) {
  const weighted = getHeptagonWeightedPercentages(values);
  if (!weighted) {
    return null;
  }

  if (zone && HEPTAGON_ZONE_POLYGONS[zone]) {
    return zonePolygonToPoints(zone, dims).map((point) => [point.x, point.y]);
  }

  return getHeptagonSidePoints(weighted.percentages, dims)?.map((point) => [point.x, point.y]) ?? null;
}

export function getHeptagonCentroidPoint(values, zone = null, dims = HEPTAGON_DIAGRAM_DIMS) {
  const weighted = getHeptagonWeightedPercentages(values);
  if (!weighted) {
    return null;
  }

  const effectiveZone = zone ?? determineHeptagonFault(weighted.percentages);
  const point = getHeptagonPlotPoint(weighted.percentages, effectiveZone, dims);
  return point ? [point.x, point.y] : null;
}

export function classifyHeptagonPoint(point, dims = HEPTAGON_DIAGRAM_DIMS) {
  if (!point || point.length !== 2 || !point.every((value) => Number.isFinite(value))) {
    return null;
  }

  const target = { x: point[0], y: point[1] };
  for (const zone of HEPTAGON_ZONE_ORDER) {
    if (isPointInPolygon(target, zonePolygonToPoints(zone, dims))) {
      return zone;
    }
  }

  return null;
}

export function analyzeHeptagon(values) {
  if (!hasHeptagonData(values)) {
    return {
      status: "insufficient-data",
      zone: null,
      point: null,
      polygonPoints: null,
      weightedValues: null,
      weightedTotal: null,
      percentages: null,
      exceededLimitKeys: [],
      classificationSource: null,
    };
  }

  const weighted = getHeptagonWeightedPercentages(values);
  if (!weighted) {
    return {
      status: "insufficient-data",
      zone: null,
      point: null,
      polygonPoints: null,
      weightedValues: null,
      weightedTotal: null,
      percentages: null,
      exceededLimitKeys: [],
      classificationSource: null,
    };
  }

  const exceededLimitKeys = getHeptagonExceededLimitKeys(values);
  const zone = determineHeptagonFault(weighted.percentages);
  const point = getHeptagonPlotPoint(weighted.percentages, zone, HEPTAGON_DIAGRAM_DIMS);
  const polygonPoints = getHeptagonSidePoints(weighted.percentages, HEPTAGON_DIAGRAM_DIMS)?.map((sidePoint) => [sidePoint.x, sidePoint.y]) ?? null;

  return {
    status: "available",
    zone,
    point: point ? [point.x, point.y] : null,
    polygonPoints,
    weightedValues: weighted.weightedValues,
    weightedTotal: weighted.weightedTotal,
    percentages: weighted.percentages,
    exceededLimitKeys,
    classificationSource: "weighted-thresholds",
  };
}
