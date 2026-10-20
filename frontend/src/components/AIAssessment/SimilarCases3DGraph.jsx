import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/card";

const VENDOR_SCRIPT_ID = "plotly-vendor-script";
const PLOTLY_VENDOR_VERSION = "gl3d-v4";
const DEFAULT_COLORS = ["#22d3ee", "#fb923c", "#34d399", "#a855f7", "#f43f5e", "#fbbf24", "#38bdf8"];

const getThemeColor = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
};

const getPlotlyVendorUrl = () => {
  if (typeof document === "undefined") return "./vendor/plotly.min.js";
  const url = new URL("vendor/plotly.min.js", document.baseURI);
  url.searchParams.set("v", PLOTLY_VENDOR_VERSION);
  return url.toString();
};

const normalizePlotly = (value) => {
  if (!value) return null;
  if (typeof value.react === "function") return value;
  if (value.default && typeof value.default.react === "function") return value.default;
  return null;
};

const loadPlotlyVendor = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("Window not available"));
  const existingPlotly = normalizePlotly(window.Plotly);
  if (existingPlotly) return Promise.resolve(existingPlotly);
  if (window.__plotlyVendorPromise) return window.__plotlyVendorPromise;

  window.__plotlyVendorPromise = new Promise((resolve, reject) => {
    const fail = (message) => {
      window.__plotlyVendorPromise = null;
      reject(new Error(message));
    };

    let existingScript = document.getElementById(VENDOR_SCRIPT_ID);
    const resolveLoadedPlotly = () => {
      const plotly = normalizePlotly(window.Plotly);
      if (plotly) {
        resolve(plotly);
        return true;
      }
      return false;
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        if (!resolveLoadedPlotly()) {
          existingScript.remove();
          existingScript = null;
        } else {
          return;
        }
      }
      if (existingScript && (existingScript.readyState === "complete" || existingScript.readyState === "loaded")) {
        if (!resolveLoadedPlotly()) {
          existingScript.remove();
          existingScript = null;
        } else {
          return;
        }
      }
      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => {
            existingScript.dataset.loaded = "true";
            if (!resolveLoadedPlotly()) fail("Plotly vendor loaded, but Plotly API is not available.");
          },
          { once: true },
        );
        existingScript.addEventListener("error", () => fail("Failed to load Plotly vendor script"), { once: true });
        return;
      }
    }

    const script = document.createElement("script");
    script.id = VENDOR_SCRIPT_ID;
    script.async = true;
    script.src = getPlotlyVendorUrl();
    script.onload = () => {
      script.dataset.loaded = "true";
      if (!resolveLoadedPlotly()) fail("Plotly vendor loaded, but Plotly API is not available.");
    };
    script.onerror = () => fail("Failed to load Plotly vendor script");
    document.head.appendChild(script);
  });

  return window.__plotlyVendorPromise;
};

const hasHullVolume = (members) => {
  if (members.length < 4) return false;
  const uniquePoints = new Set(members.map((item) => `${toNumber(item.x)}|${toNumber(item.y)}|${toNumber(item.z)}`));
  return uniquePoints.size >= 4;
};

export default function SimilarCases3DGraph({ plot3d, height = 420 }) {
  const plotRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const points = plot3d?.points || [];
  const variance = plot3d?.variance_explained || [];

  const theme = {
    text: getThemeColor("--text", "#e2e8f0"),
    textDim: getThemeColor("--text-dim", "#94a3b8"),
    textMuted: getThemeColor("--text-muted", "#64748b"),
    accentBorder: getThemeColor("--accent-border", "rgba(255, 255, 255, 0.18)"),
    accentSoft: getThemeColor("--accent-soft", "rgba(255, 255, 255, 0.08)"),
    bgCard: getThemeColor("--bg-card", "#111113"),
    bgInput: getThemeColor("--bg-input", "#18181b"),
  };

  const traces = useMemo(() => {
    if (!points.length) return [];

    const casePoints = points.filter((item) => item.role !== "target");
    const target = points.find((item) => item.role === "target") || null;
    const clusterIds = Array.from(new Set(casePoints.map((item) => Number(item.cluster) || 0))).sort((a, b) => a - b);
    const traceList = [];

    clusterIds.forEach((clusterId, idx) => {
      const members = casePoints.filter((item) => (Number(item.cluster) || 0) === clusterId);
      if (!members.length) return;
      const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

      if (hasHullVolume(members)) {
        traceList.push({
          type: "mesh3d",
          name: `Cluster ${clusterId + 1} Hull`,
          showlegend: false,
          hoverinfo: "skip",
          alphahull: 7,
          opacity: 0.08,
          color,
          flatshading: true,
          x: members.map((item) => toNumber(item.x)),
          y: members.map((item) => toNumber(item.y)),
          z: members.map((item) => toNumber(item.z)),
        });
      }

      traceList.push({
        type: "scatter3d",
        mode: "markers",
        name: `Cluster ${clusterId + 1}`,
        showlegend: false,
        x: members.map((item) => toNumber(item.x)),
        y: members.map((item) => toNumber(item.y)),
        z: members.map((item) => toNumber(item.z)),
        customdata: members.map((item) => ([
          item.transformer || item.name || "-",
          item.site || "-",
          item.voltage || "-",
          item.oilBrand || "-",
          item.fault || item.fault_code || "-",
          item.similarity,
          item.retrieved ? "Top match" : "Context case",
          item.tdcg,
          item.age,
        ])),
        marker: {
          size: members.map((item) => (item.retrieved ? 7 : 5)),
          color,
          opacity: members.map((item) => (item.retrieved ? 0.95 : 0.45)),
          line: {
            color: "rgba(255,255,255,0.45)",
            width: 0.8,
          },
        },
        hoverlabel: {
          bgcolor: "rgba(15, 23, 42, 0.96)",
          bordercolor: color,
          font: { color: "#e2e8f0", size: 12 },
        },
        hovertemplate:
          "<b>%{customdata[0]}</b><br>" +
          "%{customdata[1]} | %{customdata[2]}<br>" +
          "Oil Brand: %{customdata[3]}<br>" +
          "Fault: %{customdata[4]}<br>" +
          "Similarity: %{customdata[5]}%<br>" +
          "TDCG: %{customdata[7]} ppm | Age: %{customdata[8]} yrs<br>" +
          "%{customdata[6]}<extra></extra>",
      });
    });

    if (target) {
      traceList.push({
        type: "scatter3d",
        mode: "markers",
        name: "Selected Sample",
        showlegend: false,
        x: [toNumber(target.x)],
        y: [toNumber(target.y)],
        z: [toNumber(target.z)],
        customdata: [[
          target.transformer || target.name || "Selected Sample",
          target.site || "-",
          target.voltage || "-",
          target.oilBrand || "-",
          target.fault || target.fault_code || "-",
          target.tdcg,
          target.age,
        ]],
        marker: {
          size: 12,
          symbol: "diamond",
          color: "#22d3ee",
          opacity: 1,
          line: { color: "#e2e8f0", width: 1.6 },
        },
        hoverlabel: {
          bgcolor: "rgba(15, 23, 42, 0.98)",
          bordercolor: "#22d3ee",
          font: { color: "#e2e8f0", size: 12 },
        },
        hovertemplate:
          "<b>%{customdata[0]}</b><br>" +
          "%{customdata[1]} | %{customdata[2]}<br>" +
          "Oil Brand: %{customdata[3]}<br>" +
          "Fault: %{customdata[4]}<br>" +
          "TDCG: %{customdata[5]} ppm | Age: %{customdata[6]} yrs<br>" +
          "Selected sample<extra></extra>",
      });
    }

    return traceList;
  }, [points]);

  const layout = useMemo(() => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    autosize: true,
    height,
    margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
    font: {
      family: "inherit",
      color: theme.text,
      size: 12,
    },
    scene: {
      bgcolor: "rgba(0,0,0,0)",
      aspectmode: "cube",
      camera: {
        center: { x: 0, y: 0, z: 0 },
        eye: { x: 1.3, y: 1.25, z: 1.1 },
      },
      xaxis: {
        title: { text: "PC1", font: { color: theme.textDim, size: 11 } },
        color: theme.textDim,
        showgrid: true,
        gridcolor: theme.accentBorder,
        gridwidth: 1.1,
        zeroline: true,
        zerolinecolor: theme.accentBorder,
        zerolinewidth: 1.2,
        showbackground: false,
        backgroundcolor: "rgba(0, 0, 0, 0)",
      },
      yaxis: {
        title: { text: "PC2", font: { color: theme.textDim, size: 11 } },
        color: theme.textDim,
        showgrid: true,
        gridcolor: theme.accentBorder,
        gridwidth: 1.1,
        zeroline: true,
        zerolinecolor: theme.accentBorder,
        zerolinewidth: 1.2,
        showbackground: false,
        backgroundcolor: "rgba(0, 0, 0, 0)",
      },
      zaxis: {
        title: { text: "PC3", font: { color: theme.textDim, size: 11 } },
        color: theme.textDim,
        showgrid: true,
        gridcolor: theme.accentBorder,
        gridwidth: 1.1,
        zeroline: true,
        zerolinecolor: theme.accentBorder,
        zerolinewidth: 1.2,
        showbackground: false,
        backgroundcolor: "rgba(0, 0, 0, 0)",
      },
    },
  }), [height, theme.accentBorder, theme.text, theme.textDim]);

  useEffect(() => {
    let isMounted = true;
    let plotlyLib = null;

    const renderPlot = async () => {
      if (!plotRef.current || traces.length === 0) return;
      setLoadError(null);

      const PlotlyLib = await loadPlotlyVendor();
      if (!PlotlyLib || typeof PlotlyLib.react !== "function") {
        throw new Error("Plotly API missing: react() unavailable");
      }
      plotlyLib = PlotlyLib;

      if (!isMounted || !plotRef.current) return;

      await PlotlyLib.react(plotRef.current, traces, layout, {
        displaylogo: false,
        responsive: true,
        scrollZoom: true,
        modeBarButtonsToRemove: ["lasso3d", "select2d", "select3d", "orbitRotation"],
      });

      setIsReady(true);

      if (typeof ResizeObserver !== "undefined" && !resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          if (plotRef.current) PlotlyLib.Plots.resize(plotRef.current);
        });
        resizeObserverRef.current.observe(plotRef.current);
      }
    };

    setIsReady(false);
    renderPlot().catch((error) => {
      if (!isMounted) return;
      setLoadError(error.message || "Failed to render 3D similar-cases graph.");
    });

    return () => {
      isMounted = false;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (plotRef.current && plotlyLib) {
        plotlyLib.purge(plotRef.current);
      }
    };
  }, [layout, traces]);

  if (!points.length) {
    return <Card variant="glass" className="p-5 text-primary-dim text-sm">3D projection is not available for this selection.</Card>;
  }

  return (
    <Card variant="glass" className="p-5">
      <div className="section-label mb-2">Similar Cases - 3D Projection</div>
      <div className="text-primary-dim text-xs mb-3">
        Method: {plot3d?.method || "PCA"}. Hull overlay appears when a fault cluster has at least 4 points.
      </div>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: `radial-gradient(circle at top, ${theme.accentSoft} 0%, ${theme.bgInput} 30%, ${theme.bgCard} 100%)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1,
            padding: "8px 10px",
            borderRadius: 10,
            border: `1px solid ${theme.accentBorder}`,
            background: theme.bgInput,
            fontSize: 11,
            color: "var(--text-dim)",
            backdropFilter: "blur(8px)",
          }}
        >
          Drag to rotate. Scroll to zoom.
        </div>

        {!isReady && !loadError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.textMuted,
              fontSize: 12,
              background: "rgba(15, 23, 42, 0.2)",
              zIndex: 0,
            }}
          >
            Loading 3D similar-cases graph...
          </div>
        )}

        {loadError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f87171",
              fontSize: 12,
              background: "rgba(15, 23, 42, 0.78)",
              zIndex: 2,
              textAlign: "center",
              padding: 16,
            }}
          >
            {loadError}
          </div>
        )}

        <div ref={plotRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div className="mt-3 text-primary-dim text-xs">
        PCA variance explained: PC1 {formatNumber(variance[0] * 100, 1)}%, PC2 {formatNumber(variance[1] * 100, 1)}%, PC3 {formatNumber(variance[2] * 100, 1)}%
        </div>
    </Card>
  );
}
