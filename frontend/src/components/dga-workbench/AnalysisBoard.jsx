import { useEffect, useMemo, useState } from "react";
import { FAULT_METADATA } from "../../lib/dga/diagnostics.js";
import { useRef } from "react";
import { DuvalDiagram, FaultZoneLegend, getDiagramTitle } from "./DuvalDiagram.jsx";
import DgaTrendingSection from "./DgaTrendingSection.jsx";

const TRIANGLE3_KEYS = {
  rapeseed: "triangle3_rapeseed",
  soybean: "triangle3_soybean",
  sunflower: "triangle3_sunflower",
  synthetic: "triangle3_synthetic",
};

const PENTAGON_KEYS = {
  mineral: "pentagon",
  soybean: "pentagon3_soybean",
  rapeseed: "pentagon3_rapeseed",
  sunflower: "pentagon3_sunflower",
  synthetic: "pentagon3_synthetic",
};

const HEPTAGON_REQUIRED_KEYS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2"];

function getCardId(card) {
  return card.id ?? `${card.type}-${card.diagramKey ?? card.oilType ?? "default"}`;
}

function hasHeptagonData(raw) {
  return HEPTAGON_REQUIRED_KEYS.every((key) => raw?.[key] != null);
}

function formatHistoryDate(date) {
  return date ? date.replace(/-/g, "/") : "-";
}

function compareSampleHistory(left, right) {
  const leftDate = left.date || "";
  const rightDate = right.date || "";

  if (leftDate === rightDate) {
    return right.id - left.id;
  }

  return rightDate.localeCompare(leftDate);
}

function getCardZone(sample, card) {
  if (card.type === "heptagon") {
    return sample.analysis.heptagon?.zone ?? sample.analysis.faultZones.heptagon ?? null;
  }

  if (card.type === "pentagon") {
    return sample.analysis.faultZones[PENTAGON_KEYS[card.oilType]] ?? null;
  }

  return sample.analysis.faultZones[card.diagramKey] ?? null;
}

function buildCardHistoryRows(samples, card) {
  return [...samples]
    .sort(compareSampleHistory)
    .map((sample) => {
      const zone = getCardZone(sample, card);

      if (!zone) {
        return null;
      }

      return {
        id: sample.id,
        displayId: sample.sampleNumber ?? sample.id,
        date: sample.date,
        zone,
        label: FAULT_METADATA[zone]?.label ?? zone,
        description: FAULT_METADATA[zone]?.description ?? zone,
      };
    })
    .filter(Boolean);
}

function buildZoneSummary(rows) {
  const summaryByZone = new Map();

  rows.forEach((row) => {
    if (!summaryByZone.has(row.zone)) {
      summaryByZone.set(row.zone, {
        zone: row.zone,
        label: row.label,
        description: row.description,
        count: 0,
      });
    }

    summaryByZone.get(row.zone).count += 1;
  });

  return [...summaryByZone.values()];
}

function buildDiagramCards(oilType, methodView, faultZones) {
  if (methodView === "heptagon") {
    return [
      {
        id: "heptagon",
        type: "heptagon",
        zone: faultZones.heptagon,
        active: true,
      },
    ];
  }

  if (methodView === "pentagon") {
    return [
      {
        type: "pentagon",
        oilType,
        zone: faultZones[PENTAGON_KEYS[oilType]],
        active: true,
      },
    ];
  }

  if (oilType === "mineral") {
    return [
      {
        type: "triangle",
        diagramKey: "triangle1",
        zone: faultZones.triangle1,
        active: true,
      },
      {
        type: "triangle",
        diagramKey: "triangle4",
        zone: faultZones.triangle4,
        active: faultZones.triangle4 != null,
      },
      {
        type: "triangle",
        diagramKey: "triangle5",
        zone: faultZones.triangle5,
        active: faultZones.triangle5 != null,
      },
    ];
  }

  return [
    {
      type: "triangle",
      diagramKey: TRIANGLE3_KEYS[oilType],
      zone: faultZones[TRIANGLE3_KEYS[oilType]],
      active: true,
    },
    {
      type: "triangle",
      diagramKey: "triangle6",
      zone: faultZones.triangle6,
      active: faultZones.triangle6 != null,
    },
  ];
}

function getCardResultLabel(card, hasRequiredData) {
  if (card.zone) {
    return card.zone;
  }

  if (card.type === "heptagon") {
    return hasRequiredData ? "Calculating" : "Pending";
  }

  return "Pending";
}

function getDiagramDescription(card, hasRequiredData, latestSample) {
  if (card.type === "heptagon") {
    if (!hasRequiredData) {
      return "Fill H2, CH4, C2H6, C2H4, C2H2, CO, and CO2 to calculate the heptagon analysis.";
    }

    const meta = card.zone ? FAULT_METADATA[card.zone] : null;
    if (meta) {
      return meta.description;
    }

    return "The heptagon analysis uses the weighted seven-gas centroid from the Gouda paper to classify the active sample.";
  }

  const meta = card.zone ? FAULT_METADATA[card.zone] : null;

  if (!hasRequiredData) {
    return "Fill the required gas fields to calculate this method.";
  }

  if (!card.active && latestSample) {
    return "This follow-up diagram is not active for the latest sample.";
  }

  if (meta) {
    return meta.description;
  }

  return "This gas combination does not produce a classified zone for this method.";
}

function getSelectedSampleDetails(card, sample) {
  if (!sample) {
    return {
      resultLabel: "Pending",
      zoneLabel: "No sample selected",
      description: "Click a plotted marker to inspect that sample.",
      zone: null,
    };
  }

  const zone = getCardZone(sample, card);

  if (zone) {
    const meta = FAULT_METADATA[zone] ?? null;

    return {
      resultLabel: zone,
      zoneLabel: meta?.label ?? zone,
      description: meta?.description ?? zone,
      zone,
    };
  }

  if (card.type === "heptagon") {
    return {
      resultLabel: "Pending",
      zoneLabel: "Incomplete heptagon data",
      description: "This sample does not have enough gas data to classify the heptagon diagram.",
      zone: null,
    };
  }

  return {
    resultLabel: "Pending",
    zoneLabel: "Not active for this sample",
    description: "This follow-up diagram does not produce a classified zone for the selected sample.",
    zone: null,
  };
}

function DiagramSummary({ card, latestSample, historyRows, hasRequiredData }) {
  const resultLabel = getCardResultLabel(card, hasRequiredData);
  const title = getDiagramTitle(card.type, card.diagramKey, card.oilType);
  const description = getDiagramDescription(card, hasRequiredData, latestSample);
  const resultHeading = card.type === "heptagon" ? "Status" : "Fault zone";
  const zoneSummary = buildZoneSummary(historyRows);

  return (
    <div className={`mx-auto w-full max-w-[316px] ${card.active ? "" : "opacity-55"}`}>
      <div className="overflow-hidden rounded-t-md border border-[color:var(--border)] bg-[var(--card-muted)]">
        <div className="border-b border-[color:var(--border)] px-5 py-3 text-[17px] font-semibold text-[#ff6a2a]">{title}</div>
        <div className="px-5 py-4 text-[14px] text-[var(--foreground)]">
          {zoneSummary.length ? (
            <div className="space-y-3">
              {zoneSummary.map((item) => (
                <div key={item.zone} className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <div className="font-semibold text-[var(--foreground)]">{`${item.zone}: ${item.label}`}</div>
                  </div>
                  <div className="text-right text-[17px] font-semibold text-[var(--foreground)]">{item.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>{description}</div>
              <div className="text-right text-[18px] font-semibold">{resultLabel}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 text-[var(--foreground)]">
        <div className="grid grid-cols-[46px_1fr_128px] items-end gap-4 px-2 text-[15px] font-semibold">
          <span>ID</span>
          <span>Date</span>
          <span>{resultHeading}</span>
        </div>
        <div className="mt-3 h-[3px] bg-[var(--primary)]" />
        {historyRows.length ? (
          <div className="max-h-[218px] overflow-y-auto">
            {historyRows.map((row, index) => (
              <div
                key={`${getCardId(card)}-${row.id}-${row.date}-${row.zone}`}
                className={`grid grid-cols-[46px_1fr_128px] gap-4 px-2 py-3 text-[15px] text-[var(--foreground)] ${
                  index % 2 === 0 ? "bg-[var(--card-muted)]" : "bg-[var(--card)]"
                }`}
              >
                <span>{row.displayId}</span>
                <span>{formatHistoryDate(row.date)}</span>
                <span>{row.zone}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[46px_1fr_128px] gap-4 bg-[var(--card-muted)] px-2 py-3 text-[15px] text-[var(--foreground)]">
            <span>{latestSample?.sampleNumber ?? "-"}</span>
            <span>{formatHistoryDate(latestSample?.date) ?? "-"}</span>
            <span>{resultLabel ?? "Pending"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagramModal({ card, oilType, latestSample, completedSamples, hasRequiredData, initialSelectedSampleId, onClose }) {
  const defaultSelectedSample =
    completedSamples.find((sample) => sample.id === initialSelectedSampleId) ??
    [...completedSamples]
      .reverse()
      .find((sample) => {
        if (card.type === "heptagon") {
          return hasHeptagonData(sample.analysis.raw);
        }

        return getCardZone(sample, card) != null;
      }) ??
    latestSample ??
    completedSamples[completedSamples.length - 1] ??
    null;
  const [selectedSampleId, setSelectedSampleId] = useState(defaultSelectedSample?.id ?? null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const modalHasInteractiveSamples = completedSamples.some((sample) => {
    if (card.type === "heptagon") {
      return hasHeptagonData(sample.analysis.raw);
    }

    return true;
  });
  const dragStateRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const ignoreBackdropClickRef = useRef(false);
  const previousBodyUserSelectRef = useRef("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    previousBodyUserSelectRef.current = document.body.style.userSelect;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.userSelect = previousBodyUserSelectRef.current;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (event.pointerId !== dragStateRef.current.pointerId) {
        return;
      }

      const nextX = dragStateRef.current.originX + event.clientX - dragStateRef.current.startX;
      const nextY = dragStateRef.current.originY + event.clientY - dragStateRef.current.startY;

      if (!dragStateRef.current.moved && (Math.abs(nextX - dragStateRef.current.originX) > 2 || Math.abs(nextY - dragStateRef.current.originY) > 2)) {
        dragStateRef.current.moved = true;
      }

      setDragOffset({ x: nextX, y: nextY });
    };

    const stopDragging = (event) => {
      if (event.pointerId !== dragStateRef.current.pointerId) {
        return;
      }

      if (dragStateRef.current.moved) {
        ignoreBackdropClickRef.current = true;
      }

      dragStateRef.current.pointerId = null;
      document.body.style.userSelect = previousBodyUserSelectRef.current;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      document.body.style.userSelect = previousBodyUserSelectRef.current;
    };
  }, [isDragging]);

  const handleDragStart = (event) => {
    if (event.button != null && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.target.setPointerCapture(event.pointerId);
    ignoreBackdropClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
      moved: false,
    };
    document.body.style.userSelect = "none";
    setIsDragging(true);
  };

  const title = getDiagramTitle(card.type, card.diagramKey, card.oilType ?? oilType);
  const selectedSample =
    completedSamples.find((sample) => sample.id === selectedSampleId) ?? latestSample ?? completedSamples[0] ?? null;
  const selectedSampleDetails = getSelectedSampleDetails(card, selectedSample);
  const resultLabel = selectedSampleDetails.resultLabel;
  const resultHeading = card.type === "heptagon" ? "Status" : "Fault zone";
  const zoneLabel = selectedSampleDetails.zoneLabel;
  const description = selectedSampleDetails.description;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay)] px-4 py-6"
      onClick={() => {
        if (ignoreBackdropClickRef.current) {
          ignoreBackdropClickRef.current = false;
          return;
        }

        onClose();
      }}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[1040px] rounded-2xl border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-dialog)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <div
          className={`absolute inset-x-0 top-0 flex h-12 items-center justify-center rounded-t-2xl border-b border-[color:var(--border)] bg-[var(--card-muted)] ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleDragStart}
          style={{ touchAction: "none" }}
        >
          <div className="h-1.5 w-16 rounded-full bg-[var(--card-strong)]" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 z-20 rounded-full border border-[color:var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-muted)]"
        >
          Close
        </button>

        <div className="grid gap-6 px-5 pb-5 pt-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-7 lg:pb-7">
          <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4">
            <div className="flex justify-center">
              <DuvalDiagram
                type={card.type}
                diagramKey={card.diagramKey}
                oilType={card.oilType ?? oilType}
                currentZone={selectedSampleDetails.zone}
                completedSamples={completedSamples}
                latestId={latestSample?.id}
                selectedId={selectedSample?.id ?? null}
                disabled={!modalHasInteractiveSamples}
                size="modal"
                onSelectSample={setSelectedSampleId}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-[color:var(--border)] bg-[var(--card-muted)] p-5 text-[var(--foreground)]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Expanded diagram</div>
              <h4 className="mt-2 text-[1.5rem] font-semibold">{title}</h4>
            </div>
            <div className="rounded-lg bg-[var(--card)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{resultHeading}</div>
              <div className="mt-2 text-lg font-semibold text-[#ff6a2a]">{resultLabel}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{zoneLabel}</div>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">{description}</p>
            <div className="rounded-lg bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Selected sample: {selectedSample ? `#${selectedSample.sampleNumber ?? selectedSample.id}` : "-"}</div>
              <div className="mt-1">Date: {formatHistoryDate(selectedSample?.date)}</div>
              <div className="mt-1">Click a marker on the diagram to inspect another sample.</div>
              <div className="mt-1">Click outside this window or press Esc to close.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisBoard({
  oilType,
  methodView,
  theme,
  reportSamples,
  completedSamples,
  latestSample,
  focusSample,
  focusAnalysis,
}) {
  const [expandedCardId, setExpandedCardId] = useState(null);
  const cards = buildDiagramCards(oilType, methodView, focusAnalysis.faultZones);
  const hasRequiredData = methodView === "heptagon" ? hasHeptagonData(focusAnalysis.raw) : focusAnalysis.requiredGasCount === 5;
  const gridClass =
    cards.length === 1
      ? "grid-cols-1"
      : cards.length === 2
        ? "grid-cols-1 xl:grid-cols-2"
        : "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3";
  const boardDescription =
    methodView === "heptagon"
      ? "The heptagon view uses seven weighted gas percentages and the plotted centroid to classify the active sample against the heptagon fault zones."
      : "The methodology of Duval's triangle or pentagon uses the gases dissolved in the insulating liquid to analyse transformer faults";
  const legendTitle = methodView === "heptagon" ? "Sample markers" : "Fault zones";

  const expandedCard = useMemo(
    () => cards.find((card) => getCardId(card) === expandedCardId) ?? null,
    [cards, expandedCardId],
  );
  const cardHistoryById = useMemo(
    () =>
      Object.fromEntries(
        cards.map((card) => [
          getCardId(card),
          buildCardHistoryRows(reportSamples, card),
        ]),
      ),
    [cards, reportSamples],
  );

  useEffect(() => {
    if (expandedCardId && !cards.some((card) => getCardId(card) === expandedCardId)) {
      setExpandedCardId(null);
    }
  }, [cards, expandedCardId]);

  return (
    <>
      <section className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] px-5 py-6 shadow-[var(--shadow-card)] lg:px-6">
        <div>
          <h2 className="text-[2rem] font-semibold text-[var(--foreground)]">Analysis</h2>
          <p className="mt-7 max-w-[980px] text-[17px] leading-8 text-[var(--foreground)]">{boardDescription}</p>
        </div>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
          <h3 className="text-[18px] font-semibold text-[var(--foreground)]">{legendTitle}</h3>
          <FaultZoneLegend />
        </div>

        <div className={`mt-8 grid gap-x-12 gap-y-10 ${gridClass}`}>
          {cards.map((card) => (
            <div key={getCardId(card)} className="min-w-0">
              <button
                type="button"
                onClick={() => setExpandedCardId(getCardId(card))}
                className="mx-auto flex w-full max-w-[360px] flex-col items-center rounded-xl transition hover:bg-[var(--card-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)]"
              >
                <DuvalDiagram
                  type={card.type}
                  diagramKey={card.diagramKey}
                  oilType={card.oilType ?? oilType}
                  currentZone={card.zone}
                  completedSamples={completedSamples}
                  latestId={latestSample?.id}
                  disabled={!card.active}
                />
                <span className="mt-1 rounded-full border border-[color:var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Click to enlarge
                </span>
              </button>
              <DiagramSummary
                card={card}
                latestSample={latestSample}
                historyRows={cardHistoryById[getCardId(card)] ?? []}
                hasRequiredData={hasRequiredData}
              />
            </div>
          ))}
        </div>
      </section>

      <DgaTrendingSection samples={reportSamples} oilType={oilType} theme={theme} />

      {expandedCard ? (
        <DiagramModal
          card={expandedCard}
          oilType={oilType}
          latestSample={latestSample}
          completedSamples={completedSamples}
          hasRequiredData={hasRequiredData}
          initialSelectedSampleId={focusSample?.id ?? null}
          onClose={() => setExpandedCardId(null)}
        />
      ) : null}
    </>
  );
}
