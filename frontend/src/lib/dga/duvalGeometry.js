const TRIANGLE_SIZE = {
  left: 60,
  right: 360,
  top: 18,
  bottom: 278,
};

const TRIANGLE_VERTICES = {
  top: [210, TRIANGLE_SIZE.top],
  left: [TRIANGLE_SIZE.left, TRIANGLE_SIZE.bottom],
  right: [TRIANGLE_SIZE.right, TRIANGLE_SIZE.bottom],
};

const PENTAGON_OUTER = [
  [0, 40],
  [38.042, 12.361],
  [23.511, -32.361],
  [-23.511, -32.361],
  [-38.042, 12.361],
];

const PENTAGON_LABELS = {
  mineral: [
    { zone: "S", x: -16, y: 16 },
    { zone: "PD", x: -4.5, y: 28.75 },
    { zone: "D1", x: 16, y: 16 },
    { zone: "D2", x: 14, y: -5 },
    { zone: "T3-H", x: 7, y: -20 },
    { zone: "C", x: -8, y: -20 },
    { zone: "O", x: -20, y: -8 },
  ],
  soybean: [
    { zone: "S", x: -8, y: 20 },
    { zone: "PD", x: -4.5, y: 28.75 },
    { zone: "D1", x: 16, y: 16 },
    { zone: "D2", x: 14, y: -5 },
    { zone: "T3", x: 10, y: -20 },
    { zone: "T2", x: -8, y: -20 },
    { zone: "T1", x: -22, y: 6 },
  ],
  rapeseed: [
    { zone: "S", x: -8, y: 20 },
    { zone: "PD", x: -4.5, y: 28.75 },
    { zone: "D1", x: 16, y: 16 },
    { zone: "D2", x: 14, y: -5 },
    { zone: "T3", x: 10, y: -20 },
    { zone: "T2", x: -8, y: -20 },
    { zone: "T1", x: -22, y: 6 },
  ],
  sunflower: [
    { zone: "S", x: -8, y: 20 },
    { zone: "PD", x: -4.5, y: 28.75 },
    { zone: "D1", x: 16, y: 16 },
    { zone: "D2", x: 14, y: -5 },
    { zone: "T3", x: 6, y: -20 },
    { zone: "T2", x: -8, y: -20 },
    { zone: "T1", x: -20, y: -5 },
  ],
  synthetic: [
    { zone: "S", x: -16, y: 12 },
    { zone: "PD", x: -4.5, y: 28.75 },
    { zone: "D1", x: 16, y: 16 },
    { zone: "D2", x: 14, y: -5 },
    { zone: "T3", x: 7, y: -20 },
    { zone: "T2", x: -8, y: -20 },
    { zone: "T1", x: -20, y: -10 },
  ],
};

function normalizeTriple(a, b, c) {
  const total = a + b + c;
  if (!total) {
    return [0, 0, 0];
  }

  return [(a / total) * 100, (b / total) * 100, (c / total) * 100];
}

function triangleToPoint(a, b, c) {
  if (a === 0 && b === 0 && c === 0) return null;
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

function createTriangleLabel(zone, a, b, c) {
  return {
    zone,
    point: triangleToPoint(a, b, c),
  };
}

function polygonToTrianglePoints(polygon) {
  return polygon.a.map((value, index) => triangleToPoint(value, polygon.b[index], polygon.c[index]));
}

function pointsToPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
    .join(" ")
    .concat(" Z");
}

function getZonePolygons(zonePolygons) {
  return Array.isArray(zonePolygons) ? zonePolygons : [zonePolygons];
}

function getPentagonGeometry(h2, c2h6, ch4, c2h4, c2h2) {
  const total = h2 + c2h6 + ch4 + c2h4 + c2h2;

  if (!total) {
    return null;
  }

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
  let centroidY = 0;

  for (const point of [0, 1, 2, 3, 4]) {
    const next = point === 4 ? 0 : point + 1;
    const factor = xCoords[point] * yCoords[next] - xCoords[next] * yCoords[point];
    centroidX += (xCoords[point] + xCoords[next]) * factor;
    centroidY += (yCoords[point] + yCoords[next]) * factor;
  }

  return {
    centroid: [centroidX / areaFactor, centroidY / areaFactor],
    summits: xCoords.map((x, index) => [x, yCoords[index]]),
  };
}

function pentagonPointToViewBox(point) {
  const scale = 4.35;
  return [210 + point[0] * scale, 170 - point[1] * scale];
}

function polygonToPentagonPoints(polygon) {
  return polygon.map((point) => pentagonPointToViewBox(point));
}

function createPentagonPolygon(xValues, yValues) {
  return xValues.slice(0, -1).map((x, index) => [x, yValues[index]]);
}

const TRIANGLE_POLYGONS = {
  triangle1: {
    PD: { a: [100, 98, 98, 100], b: [0, 2, 0, 0], c: [0, 0, 2, 0] },
    T1: { a: [96, 76, 80, 98, 98, 96], b: [4, 4, 0, 0, 2, 4], c: [0, 20, 20, 2, 0, 0] },
    T2: { a: [80, 76, 46, 50, 80], b: [0, 4, 4, 0, 0], c: [20, 20, 50, 50, 20] },
    T3: { a: [50, 35, 0, 0, 50], b: [0, 15, 15, 0, 0], c: [50, 50, 85, 100, 50] },
    DT: { a: [87, 47, 31, 0, 0, 35, 46, 96, 87], b: [13, 13, 29, 29, 15, 15, 4, 4, 13], c: [0, 40, 40, 71, 85, 50, 50, 0, 0] },
    D1: { a: [0, 0, 64, 87, 0], b: [100, 77, 13, 13, 100], c: [0, 23, 23, 0, 0] },
    D2: { a: [64, 0, 0, 31, 47, 64], b: [13, 77, 29, 29, 13, 13], c: [23, 23, 71, 40, 40, 23] },
  },
  triangle3_soybean: {
    PD: { a: [100, 98, 98, 100], b: [0, 2, 0, 0], c: [0, 0, 2, 0] },
    T1: { a: [96, 53, 57, 98, 98, 96], b: [4, 4, 0, 0, 2, 4], c: [0, 43, 43, 2, 0, 0] },
    T2: { a: [57, 53, 33, 37, 57], b: [0, 4, 4, 0, 0], c: [43, 43, 63, 63, 43] },
    T3: { a: [37, 22, 0, 0, 37], b: [0, 15, 15, 0, 0], c: [63, 63, 85, 100, 63] },
    DT: { a: [87, 47, 31, 0, 0, 22, 33, 96, 87], b: [13, 13, 29, 29, 15, 15, 4, 4, 13], c: [0, 40, 40, 71, 85, 63, 63, 0, 0] },
    D1: { a: [0, 0, 62, 87, 0], b: [100, 75, 13, 13, 100], c: [0, 25, 25, 0, 0] },
    D2: { a: [62, 0, 0, 31, 47, 62], b: [13, 75, 29, 29, 13, 13], c: [25, 25, 71, 40, 40, 25] },
  },
  triangle3_sunflower: {
    PD: { a: [100, 98, 98, 100], b: [0, 2, 0, 0], c: [0, 0, 2, 0] },
    T1: { a: [96, 44, 48, 98, 98, 96], b: [4, 4, 0, 0, 2, 4], c: [0, 52, 52, 2, 0, 0] },
    T2: { a: [48, 44, 15, 19, 48], b: [0, 4, 4, 0, 0], c: [52, 52, 81, 81, 52] },
    T3: { a: [19, 0, 0, 19], b: [0, 19, 0, 0], c: [81, 81, 100, 81] },
    DT: { a: [87, 47, 31, 0, 0, 15, 96, 87], b: [13, 13, 29, 29, 19, 4, 4, 13], c: [0, 40, 40, 71, 81, 81, 0, 0] },
    D1: { a: [0, 0, 67, 87, 0], b: [100, 80, 13, 13, 100], c: [0, 20, 20, 0, 0] },
    D2: { a: [67, 0, 0, 31, 47, 67], b: [13, 80, 29, 29, 13, 13], c: [20, 20, 71, 40, 40, 20] },
  },
  triangle3_synthetic: {
    PD: { a: [100, 98, 98, 100], b: [0, 2, 0, 0], c: [0, 0, 2, 0] },
    T1: { a: [96, 57, 61, 98, 98, 96], b: [4, 4, 0, 0, 2, 4], c: [0, 39, 39, 2, 0, 0] },
    T2: { a: [61, 57, 28, 32, 61], b: [0, 4, 4, 0, 0], c: [39, 39, 68, 68, 39] },
    T3: { a: [32, 17, 0, 0, 32], b: [0, 15, 15, 0, 0], c: [68, 68, 85, 100, 68] },
    DT: { a: [87, 47, 31, 0, 0, 17, 28, 96, 87], b: [13, 13, 29, 29, 15, 15, 4, 4, 13], c: [0, 40, 40, 71, 85, 68, 68, 0, 0] },
    D1: { a: [0, 0, 61, 87, 0], b: [100, 74, 13, 13, 100], c: [0, 26, 26, 0, 0] },
    D2: { a: [61, 0, 0, 31, 47, 61], b: [13, 74, 29, 29, 13, 13], c: [26, 26, 71, 40, 40, 26] },
  },
  triangle4: {
    PD: { a: [98, 97, 84, 85, 98], b: [0, 1, 1, 0, 0], c: [2, 2, 15, 15, 2] },
    S: {
      a: [100, 54, 9, 9, 15, 15, 40, 64, 85, 84, 97, 98, 100],
      b: [0, 46, 46, 30, 30, 24, 24, 0, 0, 1, 1, 0, 0],
      c: [0, 0, 45, 61, 55, 61, 36, 36, 15, 15, 2, 2, 0],
    },
    O: { a: [0, 0, 9, 9, 0], b: [100, 30, 30, 91, 100], c: [0, 70, 61, 0, 0] },
    C: { a: [0, 0, 64, 40, 15, 15, 0], b: [30, 0, 0, 24, 24, 30, 30], c: [70, 100, 36, 36, 61, 55, 70] },
    ND: { a: [54, 9, 9, 54], b: [46, 91, 46, 46], c: [0, 0, 45, 0] },
  },
  triangle5: {
    PD: { a: [85, 84, 97, 98, 85], b: [15, 15, 2, 2, 15], c: [0, 1, 1, 0, 0] },
    S: { a: [46, 36, 75, 85, 46], b: [54, 54, 15, 15, 54], c: [0, 10, 10, 0, 0] },
    O: [
      { a: [0, 0, 36, 46, 0], b: [100, 90, 54, 54, 100], c: [0, 10, 10, 0, 0] },
      { a: [84, 75, 90, 100, 98, 97, 84], b: [15, 15, 0, 0, 2, 2, 15], c: [1, 10, 10, 0, 0, 1, 1] },
    ],
    "T2-H": { a: [90, 78, 53, 65, 90], b: [0, 12, 12, 0, 0], c: [10, 10, 35, 35, 10] },
    "T3-H": [
      { a: [0, 0, 35, 0], b: [65, 30, 30, 65], c: [35, 70, 35, 35] },
      { a: [0, 0, 65, 53, 38, 36, 16], b: [30, 0, 0, 12, 12, 14, 14], c: [70, 100, 35, 35, 50, 50, 70] },
    ],
    C: { a: [78, 60, 0, 16, 36, 38, 78], b: [12, 30, 30, 14, 14, 12, 12], c: [10, 10, 70, 70, 50, 50, 10] },
    ND: { a: [0, 60, 35, 0, 0], b: [90, 30, 30, 65, 90], c: [10, 10, 35, 35, 10] },
  },
  triangle6: {
    PD: { a: [98, 97, 87, 88, 98], b: [0, 1, 1, 0, 0], c: [2, 2, 12, 12, 2] },
    S: { a: [100, 0, 0, 87, 97, 98, 100], b: [0, 100, 88, 1, 1, 0, 0], c: [0, 0, 12, 12, 2, 2, 0] },
    O: { a: [0, 0, 9, 9, 0], b: [88, 24, 24, 79, 88], c: [12, 76, 67, 12, 12] },
    C: { a: [64, 40, 0, 0, 64], b: [0, 24, 24, 0, 0], c: [36, 36, 76, 100, 36] },
    ND: { a: [88, 9, 9, 40, 64], b: [0, 79, 24, 24, 0], c: [12, 12, 67, 36, 36] },
  },
};

const PENTAGON_POLYGONS = {
  mineral: {
    S: createPentagonPolygon([0, -35, -38.042, 0, 0, -1, -1, 0, 0], [1.5, 3, 12.361, 40, 33, 33, 24.5, 24.5, 1.5]),
    PD: createPentagonPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
    O: createPentagonPolygon([-3.5, -11, -21.483, -23.511, -35, 0, 0, -3.5], [-3, -8, -32.361, -32.361, 3, 1.5, -3, -3]),
    C: createPentagonPolygon([-3.5, 2.492, -21.483, -11, -3.5], [-3, -32.361, -32.361, -8, -3]),
    "T3-H": createPentagonPolygon([0, 24.204, 23.511, 2.492, -3.5, 0], [-3, -30.299, -32.361, -32.361, -3, -3]),
    D2: createPentagonPolygon([4, 32.061, 24.204, 0, 0, 4], [16, -6.048, -30.299, -3, 1.5, 16]),
    D1: createPentagonPolygon([0, 38.042, 32.061, 4, 0, 0], [40, 12.361, -6.048, 16, 1.5, 40]),
  },
  soybean: {
    D2: createPentagonPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 3, -3, -30.229, -6.048, 16]),
    D1: createPentagonPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 3, 16, -6.048, 12.361, 40]),
    T3: createPentagonPolygon([0, 0.01, 23.511, 24.204, 0], [-3, -32.361, -32.361, -30.229, -3]),
    T2: createPentagonPolygon([0, -7, -22.483, 0.01, 0], [3, 3, -32.361, -32.361, 3]),
    T1: createPentagonPolygon([0, -8, -37.991, -38.042, -23.511, -22.483, -7, 0], [3, 6, 12.398, 12.361, -32.361, -32.361, 3, 3]),
    S: createPentagonPolygon([0, 0, -1, -1, 0, 0, -8, -37.991, 0], [40, 33, 33, 24.5, 24.5, 3, 6, 12.398, 40]),
    PD: createPentagonPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
  },
  rapeseed: {
    D2: createPentagonPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 3, -3, -30.229, -6.048, 16]),
    D1: createPentagonPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 3, 16, -6.048, 12.361, 40]),
    T3: createPentagonPolygon([0, 0.01, 23.511, 24.204, 0], [-3, -32.361, -32.361, -30.229, -3]),
    T2: createPentagonPolygon([0, -7, -22.483, 0.01, 0], [3, 3, -32.361, -32.361, 3]),
    T1: createPentagonPolygon([0, -8, -37.991, -38.042, -23.511, -22.483, -7, 0], [3, 6, 12.398, 12.361, -32.361, -32.361, 3, 3]),
    S: createPentagonPolygon([0, 0, -1, -1, 0, 0, -8, -37.991, 0], [40, 33, 33, 24.5, 24.5, 3, 6, 12.398, 40]),
    PD: createPentagonPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
  },
  sunflower: {
    D2: createPentagonPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 1.5, -3, -30.229, -6.048, 16]),
    D1: createPentagonPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 1.5, 16, -6.048, 12.361, 40]),
    T3: createPentagonPolygon([0, 0, 23.511, 24.204, 0], [-3, -32.361, -32.361, -30.229, -3]),
    T2: createPentagonPolygon([0, -6.4, -6.5, 0, 0], [-3, -4, -32.361, -32.361, -3]),
    T1: createPentagonPolygon([0, -13.5, -24.933, -23.511, -6.5, -6.4, 0, 0], [1.5, -2, -27.984, -32.361, -32.361, -4, -3, 1.5]),
    S: createPentagonPolygon([0, 0, -1, -1, 0, 0, -13.5, -24.933, -38.042, 0], [40, 33, 33, 24.5, 24.5, 1.5, -2, -27.984, 12.361, 40]),
    PD: createPentagonPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
  },
  synthetic: {
    D2: createPentagonPolygon([4, 0, 0, 24.204, 32.061, 4], [16, 1.5, -3, -30.229, -6.048, 16]),
    D1: createPentagonPolygon([0, 0, 4, 32.061, 38.042, 0], [40, 1.5, 16, -6.048, 12.361, 40]),
    T3: createPentagonPolygon([0, -2, 2.493, 23.511, 24.204, 0], [-3, -9, -32.361, -32.361, -30.229, -3]),
    T2: createPentagonPolygon([-2, -13, -25.618, -23.511, 2.493, -2], [-9, -8, -25.876, -32.361, -32.361, -9]),
    T1: createPentagonPolygon([0, -13, -31.379, -25.618, -13, -2, 0], [-3, -1, -8.147, -25.876, -8, -9, -3]),
    S: createPentagonPolygon([0, 0, -1, -1, 0, 0, -13, -31.379, -38.042, 0], [40, 33, 33, 24.5, 24.5, -3, -1, -8.147, 12.361, 40]),
    PD: createPentagonPolygon([0, -1, -1, 0, 0], [33, 33, 24.5, 24.5, 33]),
  },
};

export const TRIANGLE_DEFINITIONS = {
  triangle1: {
    title: "Triangle 1 (mineral oil)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Acetylene C2H2 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle1,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h2, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h2, raw.c2h4));
    },
    labelPositions: {
      PD: [210, 22],
      D1: [118, 168],
      D2: [187, 168],
      DT: [242, 170],
      T1: [263, 63],
      T2: [274, 101],
      T3: [315, 168],
    },
  },
  triangle3_soybean: {
    title: "Triangle 3 (soybean)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Acetylene C2H2 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle3_soybean,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h2, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h2, raw.c2h4));
    },
    labelPositions: null,
  },
  triangle3_rapeseed: {
    title: "Triangle 3 (rapeseed)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Acetylene C2H2 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle3_soybean,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h2, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h2, raw.c2h4));
    },
    labelPositions: null,
  },
  triangle3_sunflower: {
    title: "Triangle 3 (sunflower)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Acetylene C2H2 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle3_sunflower,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h2, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h2, raw.c2h4));
    },
    labelPositions: null,
  },
  triangle3_synthetic: {
    title: "Triangle 3 (synthetic ester)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Acetylene C2H2 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle3_synthetic,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h2, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h2, raw.c2h4));
    },
    labelPositions: null,
  },
  triangle4: {
    title: "Triangle 4 (mineral oil)",
    axes: {
      left: "Hydrogen H2 %",
      bottom: "Ethane C2H6 %",
      right: "Methane CH4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle4,
    plotPoint(raw) {
      if ([raw.h2, raw.c2h6, raw.ch4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.h2, raw.c2h6, raw.ch4));
    },
    labelPositions: {
      PD: [247, 40],
      S: [203, 94],
      C: [287, 149],
      O: [232, 236],
      ND: [140, 155],
    },
  },
  triangle5: {
    title: "Triangle 5 (mineral oil)",
    axes: {
      left: "Methane CH4 %",
      bottom: "Ethane C2H6 %",
      right: "Ethylene C2H4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle5,
    plotPoint(raw) {
      if ([raw.ch4, raw.c2h6, raw.c2h4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.ch4, raw.c2h6, raw.c2h4));
    },
    labelPositions: [
      createTriangleLabel("PD", 97, 2, 1),
      createTriangleLabel("O", 90, 5, 5),
      createTriangleLabel("S", 65, 30, 5),
      createTriangleLabel("T2-H", 73, 6, 21),
      createTriangleLabel("C", 49, 21, 30),
      createTriangleLabel("O", 25, 70, 5),
      createTriangleLabel("T3-H", 13, 40.5, 46.5),
      createTriangleLabel("T3-H", 13, 9, 78),
    ],
  },
  triangle6: {
    title: "Triangle 6",
    axes: {
      left: "Hydrogen H2 %",
      bottom: "Ethane C2H6 %",
      right: "Methane CH4 %",
    },
    polygons: TRIANGLE_POLYGONS.triangle6,
    plotPoint(raw) {
      if ([raw.h2, raw.c2h6, raw.ch4].some((value) => value == null)) {
        return null;
      }
      return triangleToPoint(...normalizeTriple(raw.h2, raw.c2h6, raw.ch4));
    },
    labelPositions: {
      PD: [249, 39],
      S: [200, 100],
      C: [272, 186],
      O: [115, 169],
      ND: [202, 166],
    },
  },
};

const SHARED_TRIANGLE_LABELS = TRIANGLE_DEFINITIONS.triangle1.labelPositions;

TRIANGLE_DEFINITIONS.triangle3_soybean.labelPositions = SHARED_TRIANGLE_LABELS;
TRIANGLE_DEFINITIONS.triangle3_sunflower.labelPositions = SHARED_TRIANGLE_LABELS;
TRIANGLE_DEFINITIONS.triangle3_synthetic.labelPositions = SHARED_TRIANGLE_LABELS;

export const PENTAGON_DEFINITIONS = {
  mineral: {
    title: "Pentagon (mineral oil)",
    polygons: PENTAGON_POLYGONS.mineral,
    labels: PENTAGON_LABELS.mineral,
  },
  soybean: {
    title: "Pentagon 3 (soybean)",
    polygons: PENTAGON_POLYGONS.soybean,
    labels: PENTAGON_LABELS.soybean,
  },
  rapeseed: {
    title: "Pentagon 3 (rapeseed)",
    polygons: PENTAGON_POLYGONS.rapeseed,
    labels: PENTAGON_LABELS.rapeseed,
  },
  sunflower: {
    title: "Pentagon 3 (sunflower)",
    polygons: PENTAGON_POLYGONS.sunflower,
    labels: PENTAGON_LABELS.sunflower,
  },
  synthetic: {
    title: "Pentagon 3 (synthetic ester)",
    polygons: PENTAGON_POLYGONS.synthetic,
    labels: PENTAGON_LABELS.synthetic,
  },
};

export function getTrianglePaths(key) {
  const config = TRIANGLE_DEFINITIONS[key];
  if (!config) {
    return [];
  }

  return Object.entries(config.polygons).flatMap(([zone, polygons]) =>
    getZonePolygons(polygons).map((polygon) => ({
      zone,
      path: pointsToPath(polygonToTrianglePoints(polygon)),
    })),
  );
}

export function getTriangleMarker(key, raw) {
  const config = TRIANGLE_DEFINITIONS[key];
  return config?.plotPoint(raw) ?? null;
}

export function getPentagonPaths(oilType) {
  const config = PENTAGON_DEFINITIONS[oilType];
  if (!config) {
    return [];
  }

  return Object.entries(config.polygons).map(([zone, polygon]) => ({
    zone,
    path: pointsToPath(polygonToPentagonPoints(polygon)),
  }));
}

function isFinitePoint(point) {
  return Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value));
}

export function getPentagonMarker(raw) {
  if ([raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2].some((value) => value == null)) {
    return null;
  }

  const geometry = getPentagonGeometry(raw.h2, raw.c2h6, raw.ch4, raw.c2h4, raw.c2h2);
  if (!geometry || !isFinitePoint(geometry.centroid)) {
    return null;
  }

  const marker = pentagonPointToViewBox(geometry.centroid);
  return isFinitePoint(marker) ? marker : null;
}

export function getPentagonLabelPoints(oilType) {
  return (PENTAGON_DEFINITIONS[oilType]?.labels ?? []).map((label) => ({
    ...label,
    point: pentagonPointToViewBox([label.x, label.y]),
  }));
}

export function getPentagonOuterPath() {
  return pointsToPath(PENTAGON_OUTER.map((point) => pentagonPointToViewBox(point)));
}

export function getTriangleOuterPath() {
  return pointsToPath([
    TRIANGLE_VERTICES.top,
    TRIANGLE_VERTICES.left,
    TRIANGLE_VERTICES.right,
  ]);
}



