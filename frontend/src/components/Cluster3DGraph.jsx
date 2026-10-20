import { useEffect, useMemo, useRef, useState } from "react";

const VENDOR_SCRIPT_ID = "plotly-vendor-script";
const PLOTLY_VENDOR_VERSION = "gl3d-v4";

const getThemeColor = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const formatNumber = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toFixed(digits);
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
        existingScript.addEventListener("load", () => {
          existingScript.dataset.loaded = "true";
          if (!resolveLoadedPlotly()) {
            fail("Plotly vendor loaded, but Plotly API is not available.");
          }
        }, { once: true });
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
      if (!resolveLoadedPlotly()) {
        fail("Plotly vendor loaded, but Plotly API is not available.");
      }
    };
    script.onerror = () => fail("Failed to load Plotly vendor script");
    document.head.appendChild(script);
  });

  return window.__plotlyVendorPromise;
};

const hasHullVolume = (members, axes) => {
  if (members.length < 4 || axes.length < 3) return false;
  const uniquePoints = new Set(
    members.map((item) => `${Number(item[axes[0].key])}|${Number(item[axes[1].key])}|${Number(item[axes[2].key])}`),
  );
  return uniquePoints.size >= 4;
};

export default function Cluster3DGraph({
  data = [],
  colors = [],
  axes = [],
  height = 360,
  faultLabelMap = {},
}) {
  const plotRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const theme = {
    text: getThemeColor("--text", "#e2e8f0"),
    textDim: getThemeColor("--text-dim", "#94a3b8"),
    textMuted: getThemeColor("--text-muted", "#64748b"),
    border: getThemeColor("--border", "#223045"),
    accentBorder: getThemeColor("--accent-border", "rgba(255, 255, 255, 0.18)"),
    accentSoft: getThemeColor("--accent-soft", "rgba(255, 255, 255, 0.08)"),
    bgCard: getThemeColor("--bg-card", "#111113"),
    bgInput: getThemeColor("--bg-input", "#18181b"),
  };

  const traces = useMemo(() => {
    if (axes.length < 3 || data.length === 0) return [];

    const clusterIds = Array.from(new Set(data.map((item) => item.cluster))).sort((a, b) => a - b);
    return clusterIds.flatMap((clusterId) => {
      const members = data.filter((item) => item.cluster === clusterId);
      const clusterColor = colors[clusterId % colors.length] || "#38bdf8";
      const clusterTraces = [];

      if (hasHullVolume(members, axes)) {
        clusterTraces.push({
          type: "mesh3d",
          name: `Cluster ${clusterId + 1} Hull`,
          showlegend: false,
          hoverinfo: "skip",
          alphahull: 0,
          opacity: 0.12,
          color: clusterColor,
          flatshading: true,
          lighting: {
            ambient: 0.7,
            diffuse: 0.25,
            roughness: 0.9,
            specular: 0.05,
          },
          x: members.map((item) => Number(item[axes[0].key]) || 0),
          y: members.map((item) => Number(item[axes[1].key]) || 0),
          z: members.map((item) => Number(item[axes[2].key]) || 0),
        });
      }

      clusterTraces.push({
        type: "scatter3d",
        mode: "markers",
        name: `Cluster ${clusterId + 1}`,
        showlegend: false,
        x: members.map((item) => Number(item[axes[0].key]) || 0),
        y: members.map((item) => Number(item[axes[1].key]) || 0),
        z: members.map((item) => Number(item[axes[2].key]) || 0),
        customdata: members.map((item) => ([
          item.name || "-",
          item.voltage || "-",
          item.loadMVA ?? "-",
          item.age ?? "-",
          item.tdcg ?? "-",
          faultLabelMap[item.duval] || item.duval || "-",
          formatNumber(item[axes[0].key]),
          formatNumber(item[axes[1].key]),
          formatNumber(item[axes[2].key]),
        ])),
        marker: {
          size: 7,
          color: clusterColor,
          opacity: 0.92,
          line: {
            color: "rgba(255,255,255,0.45)",
            width: 1,
          },
        },
        hoverlabel: {
          bgcolor: "rgba(15, 23, 42, 0.96)",
          bordercolor: clusterColor,
          font: {
            color: "#e2e8f0",
            size: 12,
          },
        },
        hovertemplate:
          "<b>%{customdata[0]}</b><br>" +
          `Cluster ${clusterId + 1} | %{customdata[1]} | %{customdata[2]} MVA<br>` +
          `${axes[0].label}: %{customdata[6]}<br>` +
          `${axes[1].label}: %{customdata[7]}<br>` +
          `${axes[2].label}: %{customdata[8]}<br>` +
          "Age: %{customdata[3]} yrs<br>" +
          "TDCG: %{customdata[4]} ppm<br>" +
          "Duval: %{customdata[5]}<extra></extra>",
      });

      return clusterTraces;
    });
  }, [axes, colors, data, faultLabelMap]);

  const layout = useMemo(() => {
    if (axes.length < 3) return null;

    return {
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
          eye: { x: 1.25, y: 1.25, z: 1.1 },
          up: { x: 0, y: 0, z: 1 },
        },
        xaxis: {
          title: { text: axes[0].label, font: { color: theme.textDim, size: 11 } },
          color: theme.textDim,
          showgrid: true,
          gridcolor: theme.accentBorder,
          gridwidth: 1.2,
          zeroline: true,
          zerolinecolor: theme.accentBorder,
          zerolinewidth: 1.2,
          showbackground: true,
          backgroundcolor: "rgba(0, 0, 0, 0)",
        },
        yaxis: {
          title: { text: axes[1].label, font: { color: theme.textDim, size: 11 } },
          color: theme.textDim,
          showgrid: true,
          gridcolor: theme.accentBorder,
          gridwidth: 1.2,
          zeroline: true,
          zerolinecolor: theme.accentBorder,
          zerolinewidth: 1.2,
          showbackground: true,
          backgroundcolor: "rgba(0, 0, 0, 0)",
        },
        zaxis: {
          title: { text: axes[2].label, font: { color: theme.textDim, size: 11 } },
          color: theme.textDim,
          showgrid: true,
          gridcolor: theme.accentBorder,
          gridwidth: 1.2,
          zeroline: true,
          zerolinecolor: theme.accentBorder,
          zerolinewidth: 1.2,
          showbackground: true,
          backgroundcolor: "rgba(0, 0, 0, 0)",
        },
      },
    };
  }, [axes, height, theme.accentBorder, theme.text, theme.textDim]);

  useEffect(() => {
    let isMounted = true;
    let plotlyLib = null;

    const renderPlot = async () => {
      if (!plotRef.current || !layout || traces.length === 0) return;

      setLoadError(null);
      const PlotlyLib = await loadPlotlyVendor();
      if (!PlotlyLib || typeof PlotlyLib.react !== "function") {
        throw new Error("Plotly API missing: react()");
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
      setLoadError(error.message || "Failed to load 3D chart.");
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

  return (
    <div className="flex flex-col gap-3">
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
            Loading 3D cluster graph...
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

        <div
          ref={plotRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
