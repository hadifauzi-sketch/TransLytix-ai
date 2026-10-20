import { Card } from "../ui/card";

const severityColors = {
  Low: "var(--success)",
  Moderate: "var(--accent)",
  High: "var(--warning)",
  Critical: "var(--danger)",
};


function SummaryBlock({ title, items }) {
  return (
    <Card variant="glass" className="p-5">
      <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">{title}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{item.label}</div>
            <div className="text-foreground text-sm font-semibold mt-1">{item.value}</div>
            {item.detail && <div className="text-muted-foreground text-[11px] mt-1 opacity-80">{item.detail}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}


function getEnergizedYear(dateValue) {
  const text = `${dateValue || ""}`.trim();
  if (!text) return "-";
  const match = text.match(/(\d{4})/);
  return match ? match[1] : text;
}


function getTransformerAge(dateValue) {
  const text = `${dateValue || ""}`.trim();
  if (!text) return "-";

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const now = new Date();
    let years = now.getFullYear() - parsed.getFullYear();
    const beforeAnniversary =
      now.getMonth() < parsed.getMonth() ||
      (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate());
    if (beforeAnniversary) years -= 1;
    return years >= 0 ? `${years} years` : "-";
  }

  const match = text.match(/(\d{4})/);
  if (!match) return "-";
  const years = new Date().getFullYear() - Number(match[1]);
  return years >= 0 ? `${years} years` : "-";
}


export default function Summary({ summary }) {
  if (!summary) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No summary data available.</Card>;
  }

  const transformer = summary.transformer || {};
  const selectedDga = summary.latest_dga || {};
  const gases = selectedDga.gases || {};
  const diagnostics = summary.diagnostics || {};
  const severity = diagnostics.severityLevel || "Moderate";
  const energizedDate = transformer.dateEnergized || "";
  const energizedYear = getEnergizedYear(energizedDate);
  const transformerAge = getTransformerAge(energizedDate);

  return (
    <div className="flex flex-col gap-4">
      <SummaryBlock
        title="Transformer Info"
        items={[
          { label: "Transformer", value: transformer.name || transformer.id || "-" },
          { label: "Site", value: transformer.site || "-" },
          { label: "Voltage", value: transformer.voltage || "-" },
          { label: "Load MVA", value: transformer.loadMVA != null ? `${transformer.loadMVA} MVA` : "-" },
          { label: "Maker", value: transformer.maker || "-" },
          { label: "Oil Brand", value: transformer.oilBrand || "-" },
          { label: "Paper Type", value: transformer.paperType || "Not specified" },
          { label: "Year Energized", value: energizedYear, detail: energizedDate || "" },
          { label: "Age", value: transformerAge },
        ]}
      />

      <SummaryBlock
        title="Selected DGA"
        items={[
          { label: "H2", value: `${gases.H2 ?? 0} ppm` },
          { label: "CH4", value: `${gases.CH4 ?? 0} ppm` },
          { label: "C2H6", value: `${gases.C2H6 ?? 0} ppm` },
          { label: "C2H4", value: `${gases.C2H4 ?? 0} ppm` },
          { label: "C2H2", value: `${gases.C2H2 ?? 0} ppm` },
          { label: "CO", value: `${gases.CO ?? 0} ppm` },
          { label: "CO2", value: `${gases.CO2 ?? 0} ppm` },
          {
            label: "TDCG",
            value: `${gases.TDCG ?? 0} ppm`,
            detail: selectedDga.tdcgCategory?.label || "",
          },
        ]}
      />

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Diagnostics</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          <Card className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Duval Triangle</div>
            <div className="text-foreground text-lg font-bold mt-2">{diagnostics.duvalTriangle?.code || "-"}</div>
            <div className="text-muted-foreground text-xs mt-1 opacity-80">{diagnostics.duvalTriangle?.label || "-"}</div>
          </Card>
          <Card className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">IEC Ratio</div>
            <div className="text-foreground text-lg font-bold mt-2">{diagnostics.iecRatio?.code || "-"}</div>
            <div className="text-muted-foreground text-xs mt-1 opacity-80">{diagnostics.iecRatio?.diagnosis || "-"}</div>
            <div className="text-muted-foreground text-[11px] mt-1 opacity-70">{diagnostics.iecRatio?.standard || ""}</div>
          </Card>
          <Card className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Rogers Ratio</div>
            <div className="text-foreground text-sm font-bold mt-2">{diagnostics.rogersRatio?.diagnosis || "-"}</div>
            <div className="text-muted-foreground text-xs mt-1 opacity-80">
              CH4/H2 {diagnostics.rogersRatio?.ratios?.CH4_H2 ?? "N/A"} | C2H2/C2H4 {diagnostics.rogersRatio?.ratios?.C2H2_C2H4 ?? "N/A"}
            </div>
            <div className="text-muted-foreground text-[11px] mt-1 opacity-70">{diagnostics.rogersRatio?.method || ""}</div>
          </Card>
          <Card className="p-4">
            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Severity Level</div>
            <div className="text-lg font-bold mt-2" style={{ color: severityColors[severity] || "var(--accent)" }}>
              {severity}
            </div>
            <div className="text-muted-foreground text-xs mt-1 opacity-80">This is the input overview before AI runs.</div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
