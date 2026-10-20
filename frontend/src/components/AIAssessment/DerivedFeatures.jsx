import { Card } from "../ui/card";

function formatFeatureValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return Number(value).toFixed(3);
}


export default function DerivedFeatures({ features }) {
  if (!features) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No derived feature data available.</Card>;
  }

  const growth = features.growth || {};
  const dominantIncrease = growth.dominant_increase || {};

  return (
    <div className="flex flex-col gap-4">
      <Card variant="glass" className="p-5">
        <h3 className="text-foreground text-sm font-semibold mb-2">Calculated Features Used by AI</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          This tab exposes the gas ratios and engineering indicators used as model inputs so the decision path stays transparent for engineers.
        </p>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {(features.ratios || []).map((ratio) => (
          <Card key={ratio.key} variant="glass" className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">{ratio.formula}</div>
            <div className="text-foreground text-lg font-bold font-mono">{formatFeatureValue(ratio.value)}</div>
            <div className="text-muted-foreground text-xs mt-1">{ratio.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {(features.indicators || []).map((indicator) => (
          <Card key={indicator.key} variant="glass" className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">{indicator.label}</div>
            <div className="text-foreground text-base font-semibold">{indicator.value}</div>
            <div className="text-muted-foreground text-xs mt-1 leading-relaxed">{indicator.detail}</div>
          </Card>
        ))}
      </div>

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Gas Increase Snapshot</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {(growth.gas_changes || []).map((item) => (
            <Card key={item.gas} className="p-3">
              <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{item.gas}</div>
              <div
                className="text-sm font-bold mt-1"
                style={{ color: item.delta >= 0 ? "var(--warning)" : "var(--success)" }}
              >
                {item.delta >= 0 ? "+" : ""}{item.delta} ppm
              </div>
            </Card>
          ))}
        </div>
        <div className="text-muted-foreground text-xs mt-3">
          Dominant increase: <span className="text-foreground font-semibold">{dominantIncrease.gas || "-"}</span>
          {" "}
          ({dominantIncrease.delta >= 0 ? "+" : ""}{dominantIncrease.delta || 0} ppm)
        </div>
      </Card>
    </div>
  );
}
