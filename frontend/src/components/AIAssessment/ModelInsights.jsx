import { Card } from "../ui/card";

const contributionColors = {
  increase: "var(--warning)",
  decrease: "var(--success)",
};


export default function ModelInsights({ insights, prediction }) {
  if (!insights) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No model insight data available.</Card>;
  }

  const contributors = insights.top_contributors || insights.chart_data || [];
  const maxInfluence = Math.max(...contributors.map((item) => item.influence_pct || 0), 1);

  return (
    <div className="flex flex-col gap-4">
      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Explanation Layer</div>
        <div className="text-foreground text-sm font-semibold">
          {prediction?.predicted_fault || insights.predicted_fault || "-"} | {prediction?.risk_level || insights.risk_level || "-"} risk
        </div>
        <div className="text-muted-foreground text-xs mt-1">
          Method: {insights.explanation_method || insights.method || "-"}
        </div>
      </Card>

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-3">Top Contributors</div>
        <div className="flex flex-col gap-3">
          {contributors.map((item) => (
            <Card key={item.feature} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-foreground text-sm font-semibold">{item.label}</div>
                  <div className="text-muted-foreground text-xs mt-1">
                    Value {item.value} | Contribution {item.contribution > 0 ? "+" : ""}{item.contribution}
                  </div>
                </div>
                <div
                  className="text-xs font-bold"
                  style={{ color: contributionColors[item.direction] || "var(--accent)" }}
                >
                  {item.influence_pct}%
                </div>
              </div>
              <div className="w-full rounded-full mt-3 bg-muted/40" style={{ height: 10 }}>
                <div
                  className="rounded-full"
                  style={{
                    height: 10,
                    width: `${Math.max((item.influence_pct / maxInfluence) * 100, 8)}%`,
                    background: contributionColors[item.direction] || "var(--accent)",
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
