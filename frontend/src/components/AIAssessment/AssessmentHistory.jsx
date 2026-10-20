import { Fragment, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";


function parseImportRows(text) {
  const lines = String(text || "").split(/\r?\n/);
  const items = [];
  const errors = [];

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    const lower = line.toLowerCase();
    if (lineNo === 1 && (lower.startsWith("resultid|") || lower.startsWith("transformerid|"))) {
      return;
    }

    const columns = line.split("|");
    if (columns.length < 2) {
      errors.push(`Line ${lineNo}: invalid format.`);
      return;
    }

    if (columns.length === 2) {
      const resultId = columns[0].trim();
      const assessmentText = columns[1].trim();
      if (!resultId || !assessmentText) {
        errors.push(`Line ${lineNo}: resultId and assessment text are required.`);
        return;
      }
      items.push({
        resultId,
        assessmentText,
        source: "manual_import",
        status: "approved",
      });
      return;
    }

    const transformerId = columns[0].trim();
    const date = columns[1].trim();
    const assessmentText = columns.slice(2).join("|").trim();
    if (!transformerId || !date || !assessmentText) {
      errors.push(`Line ${lineNo}: transformerId, date, and assessment text are required.`);
      return;
    }
    items.push({
      transformerId,
      date,
      assessmentText,
      source: "manual_import",
      status: "approved",
    });
  });

  return { items, errors };
}


export default function AssessmentHistory({
  history,
  saving,
  onLoadToDraft,
  onSaveHistory,
  onViewResult,
  onImportHistory,
}) {
  const items = history?.items || [];

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.assessmentText || "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
    setError("");
  };

  const saveEdit = async (item) => {
    if (!editingText.trim()) {
      setError("Assessment text cannot be empty.");
      return;
    }
    try {
      await onSaveHistory?.(item, editingText);
      cancelEdit();
    } catch (err) {
      setError(err.message || "Failed to update approved assessment.");
    }
  };

  const importBulkRows = async () => {
    setBulkError("");
    setBulkMessage("");

    const { items: parsedItems, errors: parseErrors } = parseImportRows(bulkText);
    if (parseErrors.length) {
      setBulkError(parseErrors.slice(0, 5).join(" "));
      return;
    }
    if (!parsedItems.length) {
      setBulkError("No valid rows to import.");
      return;
    }

    setImporting(true);
    try {
      const result = await onImportHistory?.(parsedItems);
      const created = Number(result?.created || 0);
      const updated = Number(result?.updated || 0);
      const skipped = Number(result?.skipped || 0);
      const total = Number(result?.total || parsedItems.length);
      setBulkMessage(`Imported ${total} rows: ${created} created, ${updated} updated, ${skipped} skipped.`);
      if (!skipped) {
        setBulkText("");
      }
      if (Array.isArray(result?.errors) && result.errors.length) {
        const first = result.errors[0];
        setBulkError(`Line ${first.line}: ${first.message}`);
      }
    } catch (err) {
      setBulkError(err.message || "Bulk import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card variant="glass" className="p-4">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Bulk Import Approved Assessments</div>
        <div className="text-muted-foreground text-xs leading-relaxed mb-3">
          Paste one row per line. Supported formats: `resultId|assessment text` or `transformerId|YYYY-MM-DD|assessment text`.
        </div>
        <Textarea
          className="min-h-[150px] resize-y"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={[
            "resultId|assessmentText",
            "R-10021|Hydrogen and ethane elevated, thermal fault indication...",
            "TX-001|2025-11-01|CO elevated with low acetylene, likely paper ageing...",
          ].join("\n")}
        />
        <div className="flex gap-2 flex-wrap mt-3">
          <Button
            type="button"
            variant="success"
            size="sm"
            disabled={importing || saving || !onImportHistory}
            onClick={importBulkRows}
          >
            {importing ? "Importing..." : "Import Rows"}
          </Button>
        </div>
        {bulkMessage && <div className="text-emerald-400 text-xs mt-2">{bulkMessage}</div>}
        {bulkError && <div className="text-destructive text-xs mt-2">{bulkError}</div>}
      </Card>

      {!history && (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">No approved assessment history available.</Card>
      )}

      {history && items.length === 0 && (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">
          No approved assessments have been saved yet. Approve a draft or import your manual interpretations to build the case library.
        </Card>
      )}

      {history && items.length > 0 && (
        <Card variant="glass" className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {["Date", "Transformer", "Fault", "Source", "Updated", "Assessment", "Actions"].map((header) => (
                  <th key={header} className="text-muted-foreground p-3 text-left text-[10px] uppercase tracking-wide border-b border-border">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const editing = editingId === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr className="border-b border-border align-top">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{item.resultDate || "-"}</td>
                      <td className="p-3 text-foreground font-semibold">{item.transformer?.name || item.transformerId}</td>
                      <td className="p-3 text-foreground">{item.faultCode} - {item.faultLabel}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground">
                          {item.source || "manual"}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{item.updatedAt || item.createdAt || "-"}</td>
                      <td className="p-3 text-muted-foreground leading-relaxed min-w-[320px]">{item.assessmentText}</td>
                      <td className="p-3">
                        <div className="flex gap-2 flex-wrap">
                          <Button type="button" variant="glass" size="sm" onClick={() => onLoadToDraft?.(item)}>
                            Load to Draft
                          </Button>
                          <Button type="button" variant="warning" size="sm" onClick={() => startEdit(item)}>
                            Edit
                          </Button>
                          <Button type="button" variant="glass" size="sm" onClick={() => onViewResult?.(item.resultId)}>
                            View Result
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {editing && (
                      <tr className="border-b border-border">
                        <td colSpan={7} className="p-4 bg-muted/40">
                          <div className="flex flex-col gap-3">
                            <Textarea
                              className="min-h-[180px] resize-y"
                              value={editingText}
                              onChange={(event) => setEditingText(event.target.value)}
                            />
                            {error && <div className="text-destructive text-xs">{error}</div>}
                            <div className="flex gap-2 flex-wrap">
                              <Button type="button" variant="success" size="sm" disabled={saving} onClick={() => saveEdit(item)}>
                                Save Changes
                              </Button>
                              <Button type="button" variant="glass" size="sm" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
