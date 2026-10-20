import { analyzeHeptagon } from "./heptagonAnalysis.js";

const TRIANGLE_FOLLOW_UP_ZONES = new Set(["PD", "DT", "T1", "T2"]);
const REQUIRED_GASES = ["h2", "ch4", "c2h6", "c2h4", "c2h2"];
const EPSILON = 1e-15;

export const FAULT_METADATA = {
  PD: {
    label: "Partial discharge",
    description: "Corona-type partial discharges are indicated by the present gas pattern.",
    tone: "medium",
  },
  D1: {
    label: "Low-energy discharges",
    description: "Electrical discharges of lower intensity are indicated by the active method.",
    tone: "high",
  },
  D2: {
    label: "High-energy discharges",
    description: "High-energy electrical discharges or arcing are indicated by the gas mix.",
    tone: "critical",
  },
  DT: {
    label: "Electrical and thermal mix",
    description: "The method points to a mixed electrical and thermal fault condition.",
    tone: "high",
  },
  T1: {
    label: "Thermal fault below 300 C",
    description: "Low-temperature thermal activity is the dominant interpretation.",
    tone: "medium",
  },
  T2: {
    label: "Thermal fault from 300 C to 700 C",
    description: "Mid-range thermal overheating is indicated by the active method.",
    tone: "high",
  },
  T3: {
    label: "Thermal fault above 700 C",
    description: "High-temperature thermal overheating is indicated by the gas pattern.",
    tone: "critical",
  },
  "T2-H": {
    label: "Thermal fault in oil only",
    description: "The follow-up triangle points to elevated thermal stress in oil.",
    tone: "high",
  },
  "T3-H": {
    label: "High-temperature thermal fault in oil",
    description: "Very high thermal stress in oil is the dominant interpretation.",
    tone: "critical",
  },
  C: {
    label: "Carbonization of paper",
    description: "Cellulose degradation or paper carbonization is indicated.",
    tone: "critical",
  },
  O: {
    label: "Overheating",
    description: "Low-temperature overheating of the liquid is indicated.",
    tone: "medium",
  },
  S: {
    label: "Stray gassing",
    description: "The gas mix is characteristic of stray gassing behavior.",
    tone: "low",
  },
  ND: {
    label: "Not determined",
    description: "The follow-up method does not produce a unique zone for this sample.",
    tone: "neutral",
  },
  normal: {
    label: "Normal",
    description: "All seven gases remain within the normal limits used by the heptagon method.",
    tone: "low",
  },
  HCCD: {
    label: "High cellulose degradation",
    description: "The heptagon pattern points to severe cellulose degradation dominated by carbon monoxide.",
    tone: "critical",
  },
  MCCD: {
    label: "Medium cellulose degradation",
    description: "The heptagon pattern indicates a moderate cellulose-degradation condition.",
    tone: "high",
  },
  LCCD: {
    label: "Low cellulose degradation",
    description: "The heptagon pattern indicates early or lower-intensity cellulose degradation.",
    tone: "medium",
  },
};

const METHOD_TITLES = {
  triangle1: "Duval Triangle 1",
  triangle4: "Duval Triangle 4",
  triangle5: "Duval Triangle 5",
  triangle6: "Duval Triangle 6",
  pentagon: "Duval Pentagon",
  triangle3_rapeseed: "Duval Triangle 3 (Rapeseed)",
  triangle3_soybean: "Duval Triangle 3 (Soybean)",
  triangle3_sunflower: "Duval Triangle 3 (Sunflower)",
  triangle3_synthetic: "Duval Triangle 3 (Synthetic)",
  pentagon3_soybean: "Duval Pentagon 3 (Soybean)",
  pentagon3_rapeseed: "Duval Pentagon 3 (Rapeseed)",
  pentagon3_sunflower: "Duval Pentagon 3 (Sunflower)",
  pentagon3_synthetic: "Duval Pentagon 3 (Synthetic)",
};

const OIL_TRIANGLE_KEYS = {
  rapeseed: "triangle3_rapeseed",
  soybean: "triangle3_soybean",
  sunflower: "triangle3_sunflower",
  synthetic: "triangle3_synthetic",
};

const OIL_PENTAGON_KEYS = {
  mineral: "pentagon",
  soybean: "pentagon3_soybean",
  rapeseed: "pentagon3_rapeseed",
  sunflower: "pentagon3_sunflower",
  synthetic: "pentagon3_synthetic",
};

const GAS_LABELS = {
  h2: "H2",
  ch4: "CH4",
  c2h6: "C2H6",
  c2h4: "C2H4",
  c2h2: "C2H2",
  co: "CO",
  co2: "CO2",
};

// IEEE C57.155-2014 Table 1 summary thresholds for transformers with no previous sample history.
const IEEE_ESTER_THRESHOLD_PROFILES = {
  soybean: {
    fluidLabel: "soybean-based natural ester",
    limits: {
      h2: 112,
      ch4: 20,
      c2h6: 232,
      c2h4: 18,
      c2h2: 1,
      co: 161,
    },
  },
  sunflower: {
    fluidLabel: "high-oleic sunflower natural ester",
    limits: {
      h2: 35,
      ch4: 25,
      c2h6: 58,
      c2h4: 16,
      c2h2: 0,
      co: 497,
    },
  },
  synthetic: {
    fluidLabel: "synthetic ester",
    limits: {
      h2: 64,
      ch4: 104,
      c2h6: 124,
      c2h4: 150,
      c2h2: 13,
      co: 1344,
    },
  },
};

const GAS_LIMIT_REFERENCE_COLUMNS = [
  { key: "h2", name: "Hydrogen", formula: "H2", unit: "ppm" },
  { key: "ch4", name: "Methane", formula: "CH4", unit: "ppm" },
  { key: "c2h6", name: "Ethane", formula: "C2H6", unit: "ppm" },
  { key: "c2h4", name: "Ethylene", formula: "C2H4", unit: "ppm" },
  { key: "c2h2", name: "Acetylene", formula: "C2H2", unit: "ppm" },
  { key: "co", name: "Carbon monoxide", formula: "CO", unit: "ppm" },
  { key: "co2", name: "Carbon dioxide", formula: "CO2", unit: "ppm" },
  { key: "o2", name: "Oxygen", formula: "O2", unit: "ppm" },
  { key: "n2", name: "Nitrogen", formula: "N2", unit: "ppm" },
];

const IEC_60599_2022_LIMITS = {
  h2: 150,
  ch4: 130,
  c2h6: 90,
  c2h4: 280,
  c2h2: 20,
  co: 600,
  co2: 14000,
};

const IEEE_C57_104_2008_CONDITION_1_LIMITS = {
  h2: 100,
  ch4: 120,
  c2h2: 1,
  c2h4: 50,
  c2h6: 65,
  co: 350,
  co2: 2500,
};

const mineralPentagonPolygons = {
  D2: toPolygon([4, 32.061, 24.204, 0, 0, 4], [16, -6.048, -30.299, -3, 1.5, 16]),
  D1: toPolygon([0, 38.042, 32.061, 4, 0, 0], [40, 12.361, -6.048, 16, 1.5, 40]),
  C: toPolygon([-3.5, 2.492, -21.483, -11, -3.5], [-3, -32.361, -32.361, -8, -3]),
  "T3-H": toPolygon([0, 24.204, 23.511, 2.492, -3.5, 0], [-3, -30.299, -32.361, -32.361, -3, -3]),
  O: toPolygon([-3.5, -11, -21.483, -23.511, -35, 0, 0, -3.5], [-3, -8, -32.361, -32.361, 3, 1.5, -3, -3]),
  S: toPolygon([0, -35, -38.042, 0, 0, -1, -1, 0, 0], [1.5, 3, 12.361, 40, 33, 33, 24.5, 24.5, 1.5]),
  PD: toPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
};

const soybeanPentagon3Polygons = {
  D2: toPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 3, -3, -30.229, -6.048, 16]),
  D1: toPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 3, 16, -6.048, 12.361, 40]),
  T3: toPolygon([0, 0.01, 23.511, 24.204, 0], [-3, -32.361, -32.361, -30.229, -3]),
  T2: toPolygon([0, -7, -22.483, 0.01, 0], [3, 3, -32.361, -32.361, 3]),
  T1: toPolygon(
    [0, -8, -37.991, -38.042, -23.511, -22.483, -7, 0],
    [3, 6, 12.398, 12.361, -32.361, -32.361, 3, 3],
  ),
  S: toPolygon([0, 0, -1, -1, 0, 0, -8, -37.991, 0], [40, 33, 33, 24.5, 24.5, 3, 6, 12.398, 40]),
  PD: toPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
};

const rapeseedPentagon3Polygons = soybeanPentagon3Polygons;

const sunflowerPentagon3Polygons = {
  D2: toPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 1.5, -3, -30.229, -6.048, 16]),
  D1: toPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 1.5, 16, -6.048, 12.361, 40]),
  T3: toPolygon([0, 0, 23.511, 24.204, 0], [-3, -32.361, -32.361, -30.229, -3]),
  T2: toPolygon([0, -6.4, -6.5, 0, 0], [-3, -4, -32.361, -32.361, -3]),
  T1: toPolygon(
    [0, -13.5, -24.933, -23.511, -6.5, -6.4, 0, 0],
    [1.5, -2, -27.984, -32.361, -32.361, -4, -3, 1.5],
  ),
  S: toPolygon([0, 0, -1, -1, 0, 0, -13.5, -24.933, -38.042, 0], [40, 33, 33, 24.5, 24.5, 1.5, -2, -27.984, 12.361, 40]),
  PD: toPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
};

const syntheticPentagon3Polygons = {
  D2: toPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 1.5, -3, -30.229, -6.048, 16]),
  D1: toPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 1.5, 16, -6.048, 12.361, 40]),
  T3: toPolygon([0, -2, 2.493, 23.511, 24.204, 0], [-3, -9, -32.361, -32.361, -30.229, -3]),
  T2: toPolygon([-2, -13, -25.618, -23.511, 2.493, -2], [-9, -8, -25.876, -32.361, -32.361, -9]),
  T1: toPolygon([0, -13, -31.379, -25.618, -13, -2, 0], [-3, -1, -8.147, -25.876, -8, -9, -3]),
  S: toPolygon([0, 0, -1, -1, 0, 0, -13, -31.379, -38.042, 0], [40, 33, 33, 24.5, 24.5, -3, -1, -8.147, 12.361, 40]),
  PD: toPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
};

function roundValue(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 0.5) / factor;
}

function roundList(values, digits = 2) {
  return values.map((value) => roundValue(value, digits));
}

function normalizeTriple(a, b, c) {
  const total = a + b + c;
  if (!total) return [0, 0, 0];
  return roundList([(a / total) * 100, (b / total) * 100, (c / total) * 100], 2);
}

function segmentLength(segment) {
  return Math.sqrt((segment[1][0] - segment[0][0]) ** 2 + (segment[1][1] - segment[0][1]) ** 2);
}

function cross(point, start, end) {
  return (point[0] - end[0]) * (start[1] - end[1]) - (point[1] - end[1]) * (start[0] - end[0]);
}

function closePolygon(points) {
  const first = points[0];
  const last = points[points.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
}

function isPointOnSegment(point, segment, epsilon = 0) {
  return (
    Math.abs(cross(point, segment[0], segment[1])) <= epsilon &&
    segmentLength([segment[0], point]) <= segmentLength(segment) &&
    segmentLength([segment[1], point]) <= segmentLength(segment)
  );
}

function pointInPolygon(point, polygon) {
  let isInside = false;
  const x = point[0];
  const y = point[1];

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const x1 = polygon[index][0];
    const y1 = polygon[index][1];
    const x2 = polygon[previous][0];
    const y2 = polygon[previous][1];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function pointOnPolygon(point, polygon, epsilon = 0) {
  const closed = closePolygon(polygon);
  for (let index = 0; index < closed.length - 1; index += 1) {
    if (isPointOnSegment(point, [closed[index], closed[index + 1]], epsilon)) {
      return true;
    }
  }
  return false;
}

function toPolygon(xValues, yValues) {
  const polygon = [];
  for (let index = 0; index < xValues.length - 1; index += 1) {
    polygon.push([xValues[index], yValues[index]]);
  }
  return polygon;
}

function getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2) {
  const total = h2 + c2h6 + ch4 + c2h4 + c2h2;
  const a = (h2 / total) * 100;
  const b = (c2h6 / total) * 100;
  const c = (ch4 / total) * 100;
  const d = (c2h4 / total) * 100;
  const e = (c2h2 / total) * 100;

  const xCoords = [
    0,
    b * Math.cos(((180 - 18) / 180) * Math.PI),
    c * Math.cos(((180 + 54) / 180) * Math.PI),
    d * Math.cos(((180 + 54 + 72) / 180) * Math.PI),
    e * Math.cos((18 / 180) * Math.PI),
  ];
  const yCoords = [
    a,
    b * Math.sin(((180 - 18) / 180) * Math.PI),
    c * Math.sin(((180 + 54) / 180) * Math.PI),
    d * Math.sin(((180 + 54 + 72) / 180) * Math.PI),
    e * Math.sin((18 / 180) * Math.PI),
  ];

  let areaFactor = 0;
  for (const point of [0, 1, 2, 3, 4]) {
    areaFactor +=
      point === 4
        ? 3 * (xCoords[point] * yCoords[0] - xCoords[0] * yCoords[point])
        : 3 * (xCoords[point] * yCoords[point + 1] - xCoords[point + 1] * yCoords[point]);
  }

  let centroidX = 0;
  for (const point of [0, 1, 2, 3, 4]) {
    centroidX +=
      point === 4
        ? (xCoords[point] + xCoords[0]) * (xCoords[point] * yCoords[0] - xCoords[0] * yCoords[point])
        : (xCoords[point] + xCoords[point + 1]) *
          (xCoords[point] * yCoords[point + 1] - xCoords[point + 1] * yCoords[point]);
  }

  let centroidY = 0;
  for (const point of [0, 1, 2, 3, 4]) {
    centroidY +=
      point === 4
        ? (yCoords[point] + yCoords[0]) * (xCoords[point] * yCoords[0] - xCoords[0] * yCoords[point])
        : (yCoords[point] + yCoords[point + 1]) *
          (xCoords[point] * yCoords[point + 1] - xCoords[point + 1] * yCoords[point]);
  }

  return {
    centroid: [roundValue(centroidX / areaFactor, 2), roundValue(centroidY / areaFactor, 2)],
  };
}

function classifyZoneByPolygon(centroid, polygons) {
  for (const zone of Object.keys(polygons)) {
    const polygon = polygons[zone];
    if (pointInPolygon(centroid, polygon) || pointOnPolygon(centroid, polygon, EPSILON)) {
      return zone;
    }
  }
  return null;
}

function classifyTriangle1(ch4, c2h2, c2h4) {
  const [a, b, c] = normalizeTriple(ch4, c2h2, c2h4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (a >= 98) return "PD";
  if (c <= 23 && b >= 13) return "D1";
  if ((c <= 40 && c > 23 && b >= 13) || (c >= 40 && b >= 29)) return "D2";
  if (a < 98 && c <= 20 && b <= 4) return "T1";
  if (c > 20 && c < 50 && b <= 4) return "T2";
  if (b <= 15 && c >= 50) return "T3";
  if ((c <= 40 && b > 4 && b < 13) || (c > 40 && c < 50 && b > 4 && b < 29) || (c >= 50 && b > 15 && b < 29)) {
    return "DT";
  }
  return null;
}

function classifyTriangle3Soybean(ch4, c2h2, c2h4) {
  const [a, b, c] = normalizeTriple(ch4, c2h2, c2h4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (a >= 98) return "PD";
  if (c <= 25 && b >= 13) return "D1";
  if ((c <= 40 && c > 25 && b >= 13) || (c >= 40 && b >= 29)) return "D2";
  if (a < 98 && c <= 43 && b <= 4) return "T1";
  if (c > 43 && c < 63 && b <= 4) return "T2";
  if (b <= 15 && c >= 63) return "T3";
  if ((c <= 40 && b > 4 && b < 13) || (c > 40 && c < 63 && b > 4 && b < 29) || (c >= 63 && b > 15 && b < 29)) {
    return "DT";
  }
  return null;
}

function classifyTriangle3Sunflower(ch4, c2h2, c2h4) {
  const [a, b, c] = normalizeTriple(ch4, c2h2, c2h4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (a >= 98) return "PD";
  if (c <= 20 && b >= 13) return "D1";
  if ((c <= 40 && c > 20 && b >= 13) || (c >= 40 && b >= 29)) return "D2";
  if (a < 98 && c <= 52 && b <= 4) return "T1";
  if (c > 52 && c <= 81 && b <= 4) return "T2";
  if (b <= 19 && c > 81) return "T3";
  if ((c < 81 && b > 4 && b < 13) || (c > 40 && c < 81 && b > 4 && b < 29)) return "DT";
  return null;
}

function classifyTriangle3Synthetic(ch4, c2h2, c2h4) {
  const [a, b, c] = normalizeTriple(ch4, c2h2, c2h4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (a >= 98) return "PD";
  if (c <= 26 && b >= 13) return "D1";
  if ((c <= 40 && c > 26 && b >= 13) || (c >= 40 && b >= 29)) return "D2";
  if (a < 98 && c <= 39 && b <= 4) return "T1";
  if (c > 39 && c < 68 && b <= 4) return "T2";
  if (b <= 15 && c >= 68) return "T3";
  if ((c <= 39 && b > 4 && b < 13) || (c > 39 && c < 68 && b > 4 && b < 29) || (c >= 68 && b > 15 && b < 29)) {
    return "DT";
  }
  return null;
}

function classifyTriangle4(h2, c2h6, ch4) {
  const [a, b, c] = normalizeTriple(h2, c2h6, ch4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (c >= 2 && c <= 15 && b <= 1) return "PD";
  if ((a > 9 && b > 30 && b < 46) || (a > 15 && b > 24 && b < 30) || (c < 36 && b >= 1 && b < 24) || (c < 36 && c > 15 && b < 1) || (c < 2 && b < 1)) {
    return "S";
  }
  if ((c >= 36 && b <= 24) || (a <= 15 && b >= 24 && b <= 30)) return "C";
  if (a <= 9 && b >= 30) return "O";
  return "ND";
}

function classifyTriangle5(ch4, c2h6, c2h4) {
  const [a, b, c] = normalizeTriple(ch4, c2h6, c2h4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (c <= 1 && b >= 2 && b <= 14) return "PD";
  if ((c > 1 && c < 10 && b >= 2 && b <= 14) || (c < 1 && b < 2) || (c < 10 && b >= 54)) return "O";
  if (c < 10 && b >= 14 && b < 54) return "S";
  if (c >= 10 && c <= 35 && b <= 12) return "T2-H";
  if ((c > 35 && b <= 12) || (c >= 49 && b >= 12 && b <= 14) || (c > 70 && b >= 14) || (c >= 35 && b >= 30)) {
    return "T3-H";
  }
  if ((c >= 10 && c < 50 && b > 12 && b <= 14) || (c >= 10 && c <= 70 && b > 14 && b < 30)) return "C";
  return "ND";
}

function classifyTriangle6(h2, c2h6, ch4) {
  const [a, b, c] = normalizeTriple(h2, c2h6, ch4);
  if (a === 0 && b === 0 && c === 0) return null;
  if (c >= 2 && c <= 12 && b <= 1) return "PD";
  if ((c <= 12 && b > 1) || (b <= 1 && c < 2)) return "S";
  if ((c >= 36 && b <= 24 && a > 9) || (a <= 9 && b < 24)) return "C";
  if (a <= 9 && b >= 24 && c > 12) return "O";
  return "ND";
}

function classifyPentagonMineral(h2, c2h6, ch4, c2h4, c2h2) {
  const { centroid } = getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2);
  return classifyZoneByPolygon(centroid, mineralPentagonPolygons);
}

function classifyPentagon3Soybean(h2, c2h6, ch4, c2h4, c2h2) {
  const { centroid } = getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2);
  return classifyZoneByPolygon(centroid, soybeanPentagon3Polygons);
}

function classifyPentagon3Rapeseed(h2, c2h6, ch4, c2h4, c2h2) {
  const { centroid } = getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2);
  return classifyZoneByPolygon(centroid, rapeseedPentagon3Polygons);
}

function classifyPentagon3Sunflower(h2, c2h6, ch4, c2h4, c2h2) {
  const { centroid } = getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2);
  return classifyZoneByPolygon(centroid, sunflowerPentagon3Polygons);
}

function classifyPentagon3Synthetic(h2, c2h6, ch4, c2h4, c2h2) {
  const { centroid } = getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2);
  return classifyZoneByPolygon(centroid, syntheticPentagon3Polygons);
}

function evaluateIecTypicalValues(values) {
  const { h2_val, ch4_val, c2h6_val, c2h4_val, c2h2_val, co_val, co2_val } = values;
  const result = { h2: false, ch4: false, c2h6: false, c2h4: false, c2h2: false, co: false, co2: false };
  if (h2_val > 150) result.h2 = true;
  if (ch4_val > 130) result.ch4 = true;
  if (c2h6_val > 90) result.c2h6 = true;
  if (c2h4_val > 280) result.c2h4 = true;
  if (c2h2_val > 20) result.c2h2 = true;
  if (co_val != null && co_val > 600) result.co = true;
  if (co2_val != null && co2_val > 14000) result.co2 = true;
  return result;
}

function evaluateIeee2008TypicalValues(values) {
  const { h2_val, ch4_val, c2h6_val, c2h4_val, c2h2_val, co_val, co2_val } = values;
  const result = { h2: false, ch4: false, c2h6: false, c2h4: false, c2h2: false, co: false, co2: false };
  if (h2_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.h2) result.h2 = true;
  if (ch4_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.ch4) result.ch4 = true;
  if (c2h6_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h6) result.c2h6 = true;
  if (c2h4_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h4) result.c2h4 = true;
  if (c2h2_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h2) result.c2h2 = true;
  if (co_val != null && co_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.co) result.co = true;
  if (co2_val != null && co2_val > IEEE_C57_104_2008_CONDITION_1_LIMITS.co2) result.co2 = true;
  return result;
}

function evaluateIeee2019TypicalValues(values) {
  const {
    h2_val,
    ch4_val,
    c2h6_val,
    c2h4_val,
    c2h2_val,
    co_val,
    co2_val,
    o2_val,
    n2_val,
    trafo_age_val,
  } = values;

  let oxygenNitrogenRatio;
  if (!o2_val || !n2_val) {
    oxygenNitrogenRatio = 1;
  } else if (o2_val === 0 || n2_val === 0) {
    oxygenNitrogenRatio = 0;
  } else {
    oxygenNitrogenRatio = o2_val / n2_val;
  }

  const result = { h2: false, ch4: false, c2h6: false, c2h4: false, c2h2: false, co: false, co2: false };

  if (oxygenNitrogenRatio <= 0.2) {
    if (h2_val > 200 || h2_val > 80) result.h2 = true;
    if (trafo_age_val) {
      if (trafo_age_val <= 30 && h2_val > 75) result.h2 = true;
      if (trafo_age_val > 30 && h2_val > 100) result.h2 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val < 10 && (ch4_val > 100 || ch4_val > 45)) result.ch4 = true;
      if (trafo_age_val >= 10 && trafo_age_val <= 30 && (ch4_val > 150 || ch4_val > 90)) result.ch4 = true;
      if (trafo_age_val > 30 && (ch4_val > 200 || ch4_val > 110)) result.ch4 = true;
    } else if (ch4_val > 150 || ch4_val > 90) {
      result.ch4 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val < 10 && (c2h6_val > 70 || c2h6_val > 30)) result.c2h6 = true;
      if (trafo_age_val >= 10 && trafo_age_val <= 30 && (c2h6_val > 175 || c2h6_val > 90)) result.c2h6 = true;
      if (trafo_age_val > 30 && (c2h6_val > 250 || c2h6_val > 150)) result.c2h6 = true;
    } else if (c2h6_val > 175 || c2h6_val > 90) {
      result.c2h6 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val < 10 && (c2h4_val > 40 || c2h4_val > 20)) result.c2h4 = true;
      if (trafo_age_val >= 10 && trafo_age_val <= 30 && (c2h4_val > 95 || c2h4_val > 50)) result.c2h4 = true;
      if (trafo_age_val > 30 && (c2h4_val > 175 || c2h4_val > 90)) result.c2h4 = true;
    } else if (c2h4_val > 100 || c2h4_val > 50) {
      result.c2h4 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val <= 30 && (c2h2_val > 2 || c2h2_val > 1)) result.c2h2 = true;
      if (trafo_age_val > 30 && (c2h2_val > 4 || c2h2_val > 1)) result.c2h2 = true;
    } else if (c2h2_val > 2 || c2h2_val > 1) {
      result.c2h2 = true;
    }

    if (co_val != null && (co_val > 1100 || co_val > 900)) result.co = true;
    if (co2_val != null) {
      if (trafo_age_val) {
        if (trafo_age_val < 10 && (co2_val > 7000 || co2_val > 5000)) result.co2 = true;
        if (trafo_age_val >= 10 && (co2_val > 14000 || co2_val > 10000)) result.co2 = true;
      } else if (co2_val > 12500 || co2_val > 9000) {
        result.co2 = true;
      }
    }
  } else {
    if (h2_val > 90 || h2_val > 40) result.h2 = true;
    if (trafo_age_val) {
      if (trafo_age_val <= 30 && (ch4_val > 60 || ch4_val > 20)) result.ch4 = true;
      if (trafo_age_val > 30 && (ch4_val > 30 || ch4_val > 20)) result.ch4 = true;
    } else if (ch4_val > 50 || ch4_val > 20) {
      result.ch4 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val < 10 && (c2h6_val > 30 || c2h6_val > 15)) result.c2h6 = true;
      if (trafo_age_val >= 10 && (c2h6_val > 40 || c2h6_val > 15)) result.c2h6 = true;
    } else if (c2h6_val > 40 || c2h6_val > 15) {
      result.c2h6 = true;
    }

    if (trafo_age_val) {
      if (trafo_age_val < 10 && (c2h4_val > 80 || c2h4_val > 25)) result.c2h4 = true;
      if (trafo_age_val >= 10 && (c2h4_val > 125 || c2h4_val > 60)) result.c2h4 = true;
    } else if (c2h4_val > 100 || c2h4_val > 50) {
      result.c2h4 = true;
    }

    if (c2h2_val > 7 || c2h2_val > 2) result.c2h2 = true;
    if (co_val != null && (co_val > 600 || co_val > 500)) result.co = true;
    if (co2_val != null) {
      if (trafo_age_val) {
        if (trafo_age_val < 10 && (co2_val > 5000 || co2_val > 3500)) result.co2 = true;
        if (trafo_age_val >= 10 && (co2_val > 8000 || co2_val > 5500)) result.co2 = true;
      } else if (co2_val > 7000 || co2_val > 5000) {
        result.co2 = true;
      }
    }
  }

  return result;
}

function buildLimitDetail({
  value,
  source,
  activeLimit = null,
  ageReferenceLimit = null,
  ageBandLabel = null,
  branchLabel = null,
  ratio = null,
  note = null,
  message = null,
  supported = true,
}) {
  const exceeded = supported && activeLimit != null && value != null ? value > activeLimit : false;

  return {
    supported,
    source,
    activeLimit,
    ageReferenceLimit,
    ageBandLabel,
    branchLabel,
    ratio,
    note,
    message,
    value,
    exceeded,
    exceedBy: exceeded ? roundValue(value - activeLimit, 1) : null,
  };
}

function getAgeBand(age) {
  if (age == null) {
    return null;
  }

  if (age < 10) {
    return { key: "lt10", label: "< 10 years" };
  }

  if (age <= 30) {
    return { key: "10to30", label: "10-30 years" };
  }

  return { key: "gt30", label: "> 30 years" };
}

function getIeeeRatioContext(raw) {
  if (!raw.o2 || !raw.n2) {
    return {
      key: "high",
      label: "O2/N2 unavailable or zero, calculator uses the IEEE > 0.2 branch",
      ratio: null,
    };
  }

  const ratio = roundValue(raw.o2 / raw.n2, 3);
  return ratio <= 0.2
    ? {
        key: "low",
        label: "O2/N2 = " + ratio + " (<= 0.2)",
        ratio,
      }
    : {
        key: "high",
        label: "O2/N2 = " + ratio + " (> 0.2)",
        ratio,
      };
}

function buildUnsupportedLimitDetails(raw, standard, message) {
  return {
    h2: buildLimitDetail({ value: raw.h2, source: standard, supported: false, message }),
    ch4: buildLimitDetail({ value: raw.ch4, source: standard, supported: false, message }),
    c2h6: buildLimitDetail({ value: raw.c2h6, source: standard, supported: false, message }),
    c2h4: buildLimitDetail({ value: raw.c2h4, source: standard, supported: false, message }),
    c2h2: buildLimitDetail({ value: raw.c2h2, source: standard, supported: false, message }),
    co: buildLimitDetail({ value: raw.co, source: standard, supported: false, message }),
    co2: buildLimitDetail({ value: raw.co2, source: standard, supported: false, message }),
    o2: buildLimitDetail({ value: raw.o2, source: standard, supported: false, message }),
    n2: buildLimitDetail({ value: raw.n2, source: standard, supported: false, message }),
    transformerAge: buildLimitDetail({ value: raw.transformerAge, source: standard, supported: false, message }),
  };
}

function buildIeeeEsterGasLimitDetails(raw, oilType) {
  const profile = IEEE_ESTER_THRESHOLD_PROFILES[oilType];

  if (!profile) {
    return buildUnsupportedLimitDetails(
      raw,
      "IEEE C57.155",
      oilType === "rapeseed"
        ? "IEEE C57.155 threshold guidance was not restored for rapeseed ester in this calculator."
        : "IEEE C57.155 threshold guidance is not available for this ester liquid in this calculator.",
    );
  }

  const sharedNote = `IEEE C57.155 Table 1 90th percentile threshold for ${profile.fluidLabel} transformers with no previous sample history.`;

  return {
    h2: buildLimitDetail({ value: raw.h2, source: "IEEE C57.155", activeLimit: profile.limits.h2, note: sharedNote }),
    ch4: buildLimitDetail({ value: raw.ch4, source: "IEEE C57.155", activeLimit: profile.limits.ch4, note: sharedNote }),
    c2h6: buildLimitDetail({ value: raw.c2h6, source: "IEEE C57.155", activeLimit: profile.limits.c2h6, note: sharedNote }),
    c2h4: buildLimitDetail({ value: raw.c2h4, source: "IEEE C57.155", activeLimit: profile.limits.c2h4, note: sharedNote }),
    c2h2: buildLimitDetail({ value: raw.c2h2, source: "IEEE C57.155", activeLimit: profile.limits.c2h2, note: sharedNote }),
    co: buildLimitDetail({ value: raw.co, source: "IEEE C57.155", activeLimit: profile.limits.co, note: sharedNote }),
    co2: buildLimitDetail({
      value: raw.co2,
      source: "IEEE C57.155",
      supported: false,
      message: "No standalone IEEE C57.155 Table 1 threshold is applied for CO2 in this calculator.",
    }),
    o2: buildLimitDetail({
      value: raw.o2,
      source: "IEEE C57.155",
      supported: false,
      message: "No standalone IEEE C57.155 Table 1 threshold is applied for O2 in this calculator.",
    }),
    n2: buildLimitDetail({
      value: raw.n2,
      source: "IEEE C57.155",
      supported: false,
      message: "No standalone IEEE C57.155 Table 1 threshold is applied for N2 in this calculator.",
    }),
    transformerAge: buildLimitDetail({
      value: raw.transformerAge,
      source: "IEEE C57.155",
      supported: false,
      message: "IEEE C57.155 Table 1 thresholds in this calculator are not age-banded.",
    }),
  };
}

function buildIeee2008GasLimitDetails(raw) {
  const sharedNote = "IEEE C57.104-2008 Table 1 Condition 1 fixed limits used by this calculator.";

  return {
    h2: buildLimitDetail({ value: raw.h2, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.h2, note: sharedNote }),
    ch4: buildLimitDetail({ value: raw.ch4, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.ch4, note: sharedNote }),
    c2h6: buildLimitDetail({ value: raw.c2h6, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h6, note: sharedNote }),
    c2h4: buildLimitDetail({ value: raw.c2h4, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h4, note: sharedNote }),
    c2h2: buildLimitDetail({ value: raw.c2h2, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.c2h2, note: sharedNote }),
    co: buildLimitDetail({ value: raw.co, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.co, note: sharedNote }),
    co2: buildLimitDetail({ value: raw.co2, source: "IEEE C57.104-2008", activeLimit: IEEE_C57_104_2008_CONDITION_1_LIMITS.co2, note: sharedNote }),
    o2: buildLimitDetail({
      value: raw.o2,
      source: "IEEE C57.104-2008",
      supported: false,
      message: "No standalone IEEE C57.104-2008 Table 1 limit is used for O2 in this calculator.",
    }),
    n2: buildLimitDetail({
      value: raw.n2,
      source: "IEEE C57.104-2008",
      supported: false,
      message: "No standalone IEEE C57.104-2008 Table 1 limit is used for N2 in this calculator.",
    }),
    transformerAge: buildLimitDetail({
      value: raw.transformerAge,
      source: "IEEE C57.104-2008",
      supported: false,
      message: "Transformer age does not change IEEE C57.104-2008 Table 1 limits in this calculator.",
    }),
  };
}

function buildIecGasLimitDetails(raw) {
  return {
    h2: buildLimitDetail({ value: raw.h2, source: "IEC 60599:2022", activeLimit: 150 }),
    ch4: buildLimitDetail({ value: raw.ch4, source: "IEC 60599:2022", activeLimit: 130 }),
    c2h6: buildLimitDetail({ value: raw.c2h6, source: "IEC 60599:2022", activeLimit: 90 }),
    c2h4: buildLimitDetail({ value: raw.c2h4, source: "IEC 60599:2022", activeLimit: 280 }),
    c2h2: buildLimitDetail({ value: raw.c2h2, source: "IEC 60599:2022", activeLimit: 20 }),
    co: buildLimitDetail({ value: raw.co, source: "IEC 60599:2022", activeLimit: 600 }),
    co2: buildLimitDetail({ value: raw.co2, source: "IEC 60599:2022", activeLimit: 14000 }),
    o2: buildLimitDetail({
      value: raw.o2,
      source: "IEC 60599:2022",
      supported: false,
      message: "No standalone IEC gas limit is used for O2 in this calculator.",
    }),
    n2: buildLimitDetail({
      value: raw.n2,
      source: "IEC 60599:2022",
      supported: false,
      message: "No standalone IEC gas limit is used for N2 in this calculator.",
    }),
    transformerAge: buildLimitDetail({
      value: raw.transformerAge,
      source: "IEC 60599:2022",
      supported: false,
      message: "Transformer age does not change IEC gas limits in this calculator.",
    }),
  };
}

function getIeeeGasLimitProfile(gasKey, ageBand, ratioContext) {
  const isLowBranch = ratioContext.key === "low";

  if (isLowBranch) {
    switch (gasKey) {
      case "h2":
        if (!ageBand) {
          return { activeLimit: 80 };
        }

        return { activeLimit: ageBand.key === "gt30" ? 100 : 75 };
      case "ch4":
        return { activeLimit: ageBand?.key === "lt10" ? 45 : ageBand?.key === "gt30" ? 110 : 90 };
      case "c2h6":
        return { activeLimit: ageBand?.key === "lt10" ? 30 : ageBand?.key === "gt30" ? 150 : 90 };
      case "c2h4":
        return { activeLimit: ageBand?.key === "lt10" ? 20 : ageBand?.key === "gt30" ? 90 : 50 };
      case "c2h2":
        return { activeLimit: 1 };
      case "co":
        return { activeLimit: 900 };
      case "co2":
        return { activeLimit: ageBand?.key === "lt10" ? 5000 : ageBand ? 10000 : 9000 };
      default:
        return { activeLimit: null };
    }
  }

  switch (gasKey) {
    case "h2":
      return { activeLimit: 40 };
    case "ch4":
      return { activeLimit: 20 };
    case "c2h6":
      return { activeLimit: 15 };
    case "c2h4":
      return { activeLimit: ageBand?.key === "lt10" ? 25 : ageBand ? 60 : 50 };
    case "c2h2":
      return { activeLimit: 2 };
    case "co":
      return { activeLimit: 500 };
    case "co2":
      return { activeLimit: ageBand?.key === "lt10" ? 3500 : ageBand ? 5500 : 5000 };
    default:
      return { activeLimit: null };
  }
}

function buildIeeeGasLimitDetails(raw) {
  const ageBand = getAgeBand(raw.transformerAge);
  const ratioContext = getIeeeRatioContext(raw);

  return {
    h2: buildLimitDetail({
      value: raw.h2,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("h2", ageBand, ratioContext),
    }),
    ch4: buildLimitDetail({
      value: raw.ch4,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("ch4", ageBand, ratioContext),
    }),
    c2h6: buildLimitDetail({
      value: raw.c2h6,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("c2h6", ageBand, ratioContext),
    }),
    c2h4: buildLimitDetail({
      value: raw.c2h4,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("c2h4", ageBand, ratioContext),
    }),
    c2h2: buildLimitDetail({
      value: raw.c2h2,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("c2h2", ageBand, ratioContext),
    }),
    co: buildLimitDetail({
      value: raw.co,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("co", ageBand, ratioContext),
    }),
    co2: buildLimitDetail({
      value: raw.co2,
      source: "IEEE C57.104-2019",
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      ...getIeeeGasLimitProfile("co2", ageBand, ratioContext),
    }),
    o2: buildLimitDetail({
      value: raw.o2,
      source: "IEEE C57.104-2019",
      supported: false,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      message: "No standalone IEEE gas limit is used for O2. It is used with N2 to choose the active branch.",
    }),
    n2: buildLimitDetail({
      value: raw.n2,
      source: "IEEE C57.104-2019",
      supported: false,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      message: "No standalone IEEE gas limit is used for N2. It is used with O2 to choose the active branch.",
    }),
    transformerAge: buildLimitDetail({
      value: raw.transformerAge,
      source: "IEEE C57.104-2019",
      supported: false,
      ageBandLabel: ageBand?.label ?? null,
      branchLabel: ratioContext.label,
      ratio: ratioContext.ratio,
      message: ageBand
        ? "Transformer age is currently using the " + ageBand.label + " band."
        : "Enter transformer age to apply the age-based IEEE gas limits.",
    }),
  };
}

function buildGasLimitDetails(raw, standard, oilType) {
  if (oilType !== "mineral") {
    if (standard === "IEEE" || standard === "IEEE_2019" || standard === "IEEE_2008") {
      return buildIeeeEsterGasLimitDetails(raw, oilType);
    }

    return buildUnsupportedLimitDetails(
      raw,
      "IEC 60599:2022",
      "IEC gas limit guidance is not available for ester liquids in this calculator.",
    );
  }

  if (standard === "IEC") {
    return buildIecGasLimitDetails(raw);
  }

  if (standard === "IEEE_2008") {
    return buildIeee2008GasLimitDetails(raw);
  }

  return buildIeeeGasLimitDetails(raw);
}

export function getGasLimitReferenceGuide() {
  const ieeeColumns = GAS_LIMIT_REFERENCE_COLUMNS.filter((column) =>
    ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2"].includes(column.key),
  );
  const iecColumns = GAS_LIMIT_REFERENCE_COLUMNS.filter((column) => Object.hasOwn(IEC_60599_2022_LIMITS, column.key));
  const esterColumns = GAS_LIMIT_REFERENCE_COLUMNS.filter((column) =>
    ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co"].includes(column.key),
  );
  const ieeeAgeBands = [
    { key: "unknown", label: "Age unknown", ageBand: null },
    { key: "lt10", label: "< 10 years", ageBand: { key: "lt10", label: "< 10 years" } },
    { key: "10to30", label: "10-30 years", ageBand: { key: "10to30", label: "10-30 years" } },
    { key: "gt30", label: "> 30 years", ageBand: { key: "gt30", label: "> 30 years" } },
  ];
  const ieeeBranches = [
    { key: "low", label: "O2/N2 <= 0.2 branch", ratioContext: { key: "low", label: "O2/N2 <= 0.2", ratio: 0.2 } },
    { key: "high", label: "O2/N2 > 0.2 branch", ratioContext: { key: "high", label: "O2/N2 > 0.2", ratio: 0.201 } },
  ];

  return {
    gasColumns: GAS_LIMIT_REFERENCE_COLUMNS,
    ieeeC57104_2019: {
      title: "IEEE C57.104-2019",
      scope: "Mineral oil",
      columns: ieeeColumns,
      branches: ieeeBranches.map((branch) => ({
        key: branch.key,
        label: branch.label,
        ageRows: ieeeAgeBands.map((ageRow) => ({
          key: `${branch.key}-${ageRow.key}`,
          label: ageRow.label,
          limits: ieeeColumns.reduce((result, column) => {
            result[column.key] = getIeeeGasLimitProfile(column.key, ageRow.ageBand, branch.ratioContext).activeLimit;
            return result;
          }, {}),
        })),
      })),
      notes: [
        "O2 and N2 do not have standalone limits in this calculator. Their ratio selects the active IEEE branch.",
        "Transformer age changes the active IEEE mineral-oil limits for some gases.",
      ],
    },
    ieeeC57104_2008: {
      title: "IEEE C57.104-2008",
      scope: "Mineral oil",
      columns: ieeeColumns,
      limits: { ...IEEE_C57_104_2008_CONDITION_1_LIMITS },
      notes: [
        "The calculator uses the Table 1 Condition 1 thresholds from IEEE C57.104-2008 as fixed gas limits.",
        "Transformer age, O2, and N2 do not change the active IEEE C57.104-2008 limits in this calculator.",
      ],
    },
    iec60599_2022: {
      title: "IEC 60599:2022",
      scope: "Mineral oil",
      columns: iecColumns,
      limits: { ...IEC_60599_2022_LIMITS },
      notes: [
        "These IEC limits are fixed in this calculator and do not change with transformer age.",
        "O2 and N2 are not used as standalone IEC gas limits here.",
      ],
    },
    ieeeC57155: {
      title: "IEEE C57.155",
      scope: "Ester liquids",
      columns: esterColumns,
      profiles: Object.entries(IEEE_ESTER_THRESHOLD_PROFILES).map(([oilType, profile]) => ({
        oilType,
        fluidLabel: profile.fluidLabel,
        limits: { ...profile.limits },
      })),
      unsupportedProfiles: [
        {
          oilType: "rapeseed",
          fluidLabel: "rapeseed natural ester",
          message: "IEEE C57.155 threshold guidance was not restored for rapeseed ester in this calculator.",
        },
      ],
      notes: [
        "These values reflect the IEEE C57.155 Table 1 90th percentile thresholds used by the calculator.",
        "CO2, O2, N2, and transformer age do not have standalone IEEE C57.155 limits in this calculator.",
      ],
    },
  };
}

function toNumberOrNull(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normaliseSample(sample) {
  return {
    h2: toNumberOrNull(sample.h2),
    ch4: toNumberOrNull(sample.ch4),
    c2h6: toNumberOrNull(sample.c2h6),
    c2h4: toNumberOrNull(sample.c2h4),
    c2h2: toNumberOrNull(sample.c2h2),
    co: toNumberOrNull(sample.co),
    co2: toNumberOrNull(sample.co2),
    o2: toNumberOrNull(sample.o2),
    n2: toNumberOrNull(sample.n2),
    transformerAge: toNumberOrNull(sample.transformerAge),
  };
}

function calculateMetrics(raw) {
  const tdcg =
    (raw.h2 ?? 0) +
    (raw.ch4 ?? 0) +
    (raw.c2h6 ?? 0) +
    (raw.c2h4 ?? 0) +
    (raw.c2h2 ?? 0) +
    (raw.co ?? 0);

  const hydrocarbonTotal = (raw.ch4 ?? 0) + (raw.c2h6 ?? 0) + (raw.c2h4 ?? 0) + (raw.c2h2 ?? 0);

  const gasMixSource = REQUIRED_GASES.map((key) => ({
    key,
    label: GAS_LABELS[key],
    value: raw[key] ?? 0,
  })).filter((item) => item.value > 0);

  const gasMixTotal = gasMixSource.reduce((sum, item) => sum + item.value, 0);
  const gasMix = gasMixSource.map((item) => ({
    ...item,
    share: gasMixTotal > 0 ? roundValue((item.value / gasMixTotal) * 100, 1) : 0,
  }));

  const majorGas = gasMixSource.reduce((largest, item) => {
    if (!largest || item.value > largest.value) {
      return item;
    }
    return largest;
  }, null);

  return {
    tdcg: roundValue(tdcg, 1),
    hydrocarbonTotal: roundValue(hydrocarbonTotal, 1),
    co2CoRatio:
      raw.co != null && raw.co !== 0 && raw.co2 != null ? roundValue(raw.co2 / raw.co, 2) : null,
    o2N2Ratio:
      raw.o2 != null && raw.o2 !== 0 && raw.n2 != null && raw.n2 !== 0
        ? roundValue(raw.o2 / raw.n2, 3)
        : null,
    gasMix,
    majorGas,
  };
}

function buildFaultZones(raw, heptagonZone = null) {
  if (!REQUIRED_GASES.every((key) => raw[key] != null)) {
    return {
      triangle1: null,
      triangle3_rapeseed: null,
      triangle3_soybean: null,
      triangle3_sunflower: null,
      triangle3_synthetic: null,
      triangle4: null,
      triangle5: null,
      triangle6: null,
      pentagon: null,
      pentagon3_soybean: null,
      pentagon3_rapeseed: null,
      pentagon3_sunflower: null,
      pentagon3_synthetic: null,
      heptagon: null,
    };
  }

  const triangle1 = classifyTriangle1(raw.ch4, raw.c2h2, raw.c2h4);
  const triangle3Soybean = classifyTriangle3Soybean(raw.ch4, raw.c2h2, raw.c2h4);

  return {
    triangle1,
    triangle3_rapeseed: triangle3Soybean,
    triangle3_soybean: triangle3Soybean,
    triangle3_sunflower: classifyTriangle3Sunflower(raw.ch4, raw.c2h2, raw.c2h4),
    triangle3_synthetic: classifyTriangle3Synthetic(raw.ch4, raw.c2h2, raw.c2h4),
    triangle4:
      triangle1 && ["PD", "T1"].includes(triangle1)
        ? classifyTriangle4(raw.h2, raw.c2h6, raw.ch4)
        : null,
    triangle5:
      triangle1 && ["T2", "T3"].includes(triangle1)
        ? classifyTriangle5(raw.ch4, raw.c2h6, raw.c2h4)
        : null,
    triangle6: TRIANGLE_FOLLOW_UP_ZONES.has(triangle3Soybean)
      ? classifyTriangle6(raw.h2, raw.c2h6, raw.ch4)
      : null,
    pentagon: classifyPentagonMineral(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2),
    pentagon3_soybean: classifyPentagon3Soybean(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2),
    pentagon3_rapeseed: classifyPentagon3Rapeseed(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2),
    pentagon3_sunflower: classifyPentagon3Sunflower(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2),
    pentagon3_synthetic: classifyPentagon3Synthetic(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2),
    heptagon: heptagonZone,
  };
}

// Rogers four-ratio method: R1=C2H2/C2H4, R2=CH4/H2, R3=C2H4/C2H6
function classifyRogers(h2, ch4, c2h6, c2h4, c2h2) {
  if (!h2 || !c2h4 || !c2h6) return null;
  const r1 = c2h2 / c2h4;
  const r2 = ch4 / h2;
  const r3 = c2h4 / c2h6;
  if (r1 < 0.1 && r2 >= 0.1 && r2 <= 1.0 && r3 < 1.0) return 'T1'; // normal aging / low-temp
  if (r1 < 0.1 && r2 < 0.1) return 'PD';
  if (r1 >= 0.1 && r1 <= 3.0 && r3 > 3.0) return 'D2'; // arcing
  if (r1 >= 0.1 && r1 <= 3.0 && r3 >= 1 && r3 <= 3.0) return 'D1';
  if (r1 < 0.1 && r2 > 1.0 && r3 <= 3.0) return 'T2'; // thermal < 700°C
  if (r1 < 0.1 && r2 > 1.0 && r3 > 3.0) return 'T3'; // thermal > 700°C
  return null;
}

// Key Gas method: dominant combustible gas identifies fault type
function classifyKeyGas(h2, ch4, c2h6, c2h4, c2h2, co) {
  const gases = { h2: h2 ?? 0, ch4: ch4 ?? 0, c2h6: c2h6 ?? 0, c2h4: c2h4 ?? 0, c2h2: c2h2 ?? 0, co: co ?? 0 };
  const total = Object.values(gases).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const dominant = Object.keys(gases).reduce((a, b) => gases[a] > gases[b] ? a : b);
  const map = { h2: 'PD', ch4: 'T1', c2h6: 'T1', c2h4: 'T3', c2h2: 'D2', co: 'C' };
  return map[dominant] || null;
}

// Severity score (0–4) for a fault zone code
export const FAULT_SEVERITY = {
  null: 0, undefined: 0,
  S: 1, O: 1, ND: 1, normal: 0,
  PD: 2, T1: 2, D1: 2, LCCD: 2,
  DT: 3, TD: 3, T2: 3, 'T2-H': 3, C: 3, MCCD: 3,
  D2: 4, T3: 4, 'T3-H': 4, HCCD: 4,
};

export function getFaultMethodsData(sample) {
  const raw = normaliseSample(sample);
  const hasGases = REQUIRED_GASES.every((key) => raw[key] != null);
  if (!hasGases) return null;

  const { h2, ch4, c2h6, c2h4, c2h2, co } = raw;
  const dt1 = classifyTriangle1(ch4, c2h2, c2h4);
  const dt4 = dt1 && ['PD', 'T1'].includes(dt1) ? classifyTriangle4(h2, c2h6, ch4) : null;
  const dt5 = dt1 && ['T2', 'T3'].includes(dt1) ? classifyTriangle5(ch4, c2h6, c2h4) : null;
  const pentagon = classifyPentagonMineral(h2, c2h6, ch4, c2h4, c2h2);
  const rogers = classifyRogers(h2, ch4, c2h6, c2h4, c2h2);
  const keyGas = classifyKeyGas(h2, ch4, c2h6, c2h4, c2h2, co);
  const heptagonZone = analyzeHeptagon(raw).zone;

  const severity = (zone) => FAULT_SEVERITY[zone] ?? 0;

  return [
    { method: 'DT1', fullName: 'Duval Triangle 1', zone: dt1, severity: severity(dt1) },
    { method: 'DT4', fullName: 'Duval Triangle 4', zone: dt4, severity: severity(dt4) },
    { method: 'DT5', fullName: 'Duval Triangle 5', zone: dt5, severity: severity(dt5) },
    { method: 'Pentagon', fullName: 'Duval Pentagon', zone: pentagon, severity: severity(pentagon) },
    { method: 'Rogers', fullName: 'Rogers Ratio', zone: rogers, severity: severity(rogers) },
    { method: 'Key Gas', fullName: 'Key Gas', zone: keyGas, severity: severity(keyGas) },
    { method: 'Heptagon', fullName: 'Heptagon', zone: heptagonZone, severity: severity(heptagonZone) },
  ];
}

export function getMethodReadouts(faultZones, oilType) {
  if (oilType === "mineral") {
    return [
      {
        key: "triangle1",
        title: METHOD_TITLES.triangle1,
        zone: faultZones.triangle1,
        hint: "Primary mineral-oil triangle using CH4, C2H2, and C2H4.",
      },
      {
        key: "triangle4",
        title: METHOD_TITLES.triangle4,
        zone: faultZones.triangle4,
        hint: "Follow-up triangle used when Triangle 1 indicates PD or T1.",
      },
      {
        key: "triangle5",
        title: METHOD_TITLES.triangle5,
        zone: faultZones.triangle5,
        hint: "Follow-up triangle used when Triangle 1 indicates T2 or T3.",
      },
      {
        key: "pentagon",
        title: METHOD_TITLES.pentagon,
        zone: faultZones.pentagon,
        hint: "Five-gas mineral-oil pentagon for broad fault discrimination.",
      },
    ];
  }

  const triangleKey = OIL_TRIANGLE_KEYS[oilType];
  const pentagonKey = OIL_PENTAGON_KEYS[oilType];

  return [
    {
      key: triangleKey,
      title: METHOD_TITLES[triangleKey],
      zone: triangleKey ? faultZones[triangleKey] : null,
      hint: "Primary ester-liquid triangle using CH4, C2H2, and C2H4.",
    },
    {
      key: "triangle6",
      title: METHOD_TITLES.triangle6,
      zone: faultZones.triangle6,
      hint: "Follow-up ester triangle using H2, C2H6, and CH4.",
    },
    {
      key: pentagonKey,
      title: METHOD_TITLES[pentagonKey],
      zone: pentagonKey ? faultZones[pentagonKey] : null,
      hint: "Five-gas pentagon variant for ester insulation liquids.",
    },
  ];
}

function pickPrimaryFault(methods) {
  const ranked = methods.filter((method) => method.zone);
  if (ranked.length === 0) {
    return null;
  }

  const priority = ["D2", "T3-H", "T3", "D1", "C", "T2-H", "T2", "DT", "PD", "O", "S", "T1", "ND"];
  ranked.sort((left, right) => priority.indexOf(left.zone) - priority.indexOf(right.zone));

  const picked = ranked[0];
  const meta = FAULT_METADATA[picked.zone];
  return {
    code: picked.zone,
    label: meta?.label ?? picked.zone,
    description: meta?.description ?? picked.hint,
    source: picked.title,
  };
}

export function createEmptySample(id = 1) {
  return {
    id,
    date: new Date().toISOString().slice(0, 10),
    h2: "",
    ch4: "",
    c2h6: "",
    c2h4: "",
    c2h2: "",
    co: "",
    co2: "",
    o2: "",
    n2: "",
    transformerAge: "",
  };
}

export function analyzeSample(sample, standard, oilType) {
  const raw = normaliseSample(sample);
  const requiredGasCount = REQUIRED_GASES.filter((key) => raw[key] != null).length;
  const heptagon = analyzeHeptagon(raw);
  const faultZones = buildFaultZones(raw, heptagon.zone);
  const methods = getMethodReadouts(faultZones, oilType);
  const metrics = calculateMetrics(raw);
  const gasLimitDetails = buildGasLimitDetails(raw, standard, oilType);
  const notes = [];

  let typicalValues = null;
  let typicalValuesStatus = "insufficient-data";

  if (requiredGasCount === REQUIRED_GASES.length) {
    if (oilType === "mineral") {
      typicalValuesStatus = "available";
      const payload = {
        h2_val: raw.h2,
        ch4_val: raw.ch4,
        c2h6_val: raw.c2h6,
        c2h4_val: raw.c2h4,
        c2h2_val: raw.c2h2,
        co_val: raw.co,
        co2_val: raw.co2,
        o2_val: raw.o2,
        n2_val: raw.n2,
        trafo_age_val: raw.transformerAge,
      };
      typicalValues =
        standard === "IEC"
          ? evaluateIecTypicalValues(payload)
          : standard === "IEEE_2008"
            ? evaluateIeee2008TypicalValues(payload)
            : evaluateIeee2019TypicalValues(payload);
    } else {
      typicalValuesStatus = "unsupported";
      notes.push("Typical-value alerts are intentionally hidden for ester liquids.");
    }
  }

  const typicalFlaggedGases = typicalValues
    ? Object.keys(typicalValues).filter((key) => typicalValues[key]).map((key) => GAS_LABELS[key])
    : [];

  const methodPriority =
    oilType === "mineral"
      ? [
          methods.find((method) => method.key === "pentagon"),
          methods.find((method) => method.key === "triangle5"),
          methods.find((method) => method.key === "triangle4"),
          methods.find((method) => method.key === "triangle1"),
        ]
      : [
          methods.find((method) => method.key === OIL_PENTAGON_KEYS[oilType]),
          methods.find((method) => method.key === "triangle6"),
          methods.find((method) => method.key === OIL_TRIANGLE_KEYS[oilType]),
        ].filter(Boolean);

  return {
    raw,
    heptagon,
    metrics,
    methods,
    notes,
    requiredGasCount,
    faultZones,
    typicalValues,
    typicalValuesStatus,
    typicalFlaggedGases,
    gasLimitDetails,
    primaryFault: pickPrimaryFault(methodPriority.filter(Boolean)),
  };
}
