"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

const D3Globe = dynamic(
  () => import("@/components/d3-globe/D3Globe"),
  { ssr: false }
);

const ANIMATION_DELAYS = ["delay-100", "delay-200", "delay-300", "delay-400"];

export default function D3Page() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [prayerBrief, setPrayerBrief] = useState<PrayerBrief | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const isPanelOpen = selectedCountry !== null;

  const handleCountrySelect = useCallback((name: string | null) => {
    setSelectedCountry(name);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedCountry(null);
      setIsClosing(false);
    }, 300);
  }, []);

  const refreshPrayerBrief = useCallback(() => {
    if (selectedCountry) {
      setRefreshTick((prev) => prev + 1);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCountry) {
      setPrayerBrief(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadPrayerBrief = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setPrayerBrief(null);

        const response = await fetch("/api/prayer-intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: selectedCountry }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Unable to load prayer brief.");
        }

        if (!response.body) {
          throw new Error("No response stream available.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        let receivedFinal = false;

        const applyDelta = (delta: string) => {
          if (!delta) return;
          streamedText += delta;
          setPrayerBrief((prev) => ({
            country: selectedCountry,
            updatedAt: prev?.updatedAt ?? new Date().toISOString(),
            text: streamedText,
            sources: prev?.sources ?? [],
          }));
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const chunk = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            const { event, data } = parseSseChunk(chunk);
            if (!data) {
              boundaryIndex = buffer.indexOf("\n\n");
              continue;
            }
            const payload = JSON.parse(data) as {
              delta?: string;
              error?: string;
              text?: string;
              sources?: Source[];
              updatedAt?: string;
              country?: string;
            };

            if (event === "delta") {
              applyDelta(payload.delta ?? "");
            } else if (event === "done") {
              receivedFinal = true;
              setPrayerBrief({
                country: payload.country ?? selectedCountry,
                updatedAt: payload.updatedAt ?? new Date().toISOString(),
                text: payload.text ?? streamedText,
                sources: payload.sources ?? [],
              });
            } else if (event === "error") {
              throw new Error(payload.error || "Unable to load prayer brief.");
            }

            boundaryIndex = buffer.indexOf("\n\n");
          }
        }

        if (!receivedFinal && streamedText) {
          setPrayerBrief((prev) =>
            prev
              ? prev
              : {
                  country: selectedCountry,
                  updatedAt: new Date().toISOString(),
                  text: streamedText,
                  sources: [],
                }
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Something went wrong.";
        setErrorMessage(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadPrayerBrief();

    return () => controller.abort();
  }, [selectedCountry, refreshTick]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const updatedLabel = useMemo(() => {
    if (!prayerBrief?.updatedAt) return null;
    const date = new Date(prayerBrief.updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }, [prayerBrief?.updatedAt]);


  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,213,247,0.3)_0%,_transparent_70%)]" />

      {/* Header */}
      <header className={`absolute top-0 left-0 right-0 z-20 p-6 ${isPanelOpen ? "max-lg:landscape:right-[45%]" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-300 to-sky-500 opacity-90" />
          <h1 className="text-2xl font-light text-gray-700 tracking-wide">
            ocean&apos;s prayer{" "}
            <span className="text-sky-500">/ d3</span>
          </h1>
        </div>
      </header>

      <div className={`relative z-10 ${isPanelOpen ? "max-lg:portrait:flex max-lg:portrait:flex-col max-lg:landscape:flex max-lg:landscape:flex-row" : ""} h-full`}>
        {/* Globe container */}
        <div className={`relative flex items-center justify-center transition-[height,width] duration-300 ease-out ${
          isPanelOpen
            ? "max-lg:portrait:h-[40vh] max-lg:portrait:min-h-[180px] max-lg:portrait:flex-shrink-0 max-lg:portrait:w-full max-lg:landscape:h-full max-lg:landscape:w-[55%] max-lg:landscape:flex-shrink-0 lg:w-full lg:h-full"
            : "w-full h-full"
        }`}>
          <div className="w-full h-full">
            <D3Globe onCountrySelect={handleCountrySelect} />
          </div>
        </div>

        {/* Floating prayer brief panel */}
        {(selectedCountry || isClosing) && (
          <aside className={[
            // Base styles
            "z-30 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/8 prayer-font-body flex flex-col overflow-hidden",
            // Portrait mobile: in-flow below globe
            "max-lg:portrait:relative max-lg:portrait:w-full max-lg:portrait:flex-1 max-lg:portrait:min-h-0 max-lg:portrait:rounded-t-3xl max-lg:portrait:pb-safe",
            isClosing
              ? "max-lg:portrait:animate-slide-out-bottom"
              : "max-lg:portrait:animate-slide-in-bottom",
            // Landscape mobile: fixed right panel
            "max-lg:landscape:fixed max-lg:landscape:right-0 max-lg:landscape:top-0 max-lg:landscape:bottom-0 max-lg:landscape:w-[45%] max-lg:landscape:max-h-full max-lg:landscape:rounded-l-3xl max-lg:landscape:pr-safe",
            isClosing
              ? "max-lg:landscape:animate-slide-out-right"
              : "max-lg:landscape:animate-slide-in-right",
            // Desktop: floating sidebar (unchanged behavior)
            "lg:fixed lg:top-6 lg:right-6 lg:bottom-6 lg:w-[400px] xl:w-[440px] lg:max-h-[calc(100vh-3rem)] lg:rounded-3xl",
            isClosing
              ? "lg:animate-slide-out-right"
              : "lg:animate-slide-in-right",
          ].join(" ")}>
            {/* Mobile drag handle */}
            <div className="lg:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-300" />
            </div>

            {/* Header */}
            <div className="px-6 pt-8 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">
                    Prayer Brief
                  </p>
                  <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] leading-tight text-neutral-900 prayer-font-display">
                    {selectedCountry}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={refreshPrayerBrief}
                    disabled={isLoading}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed ${
                      isLoading ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`w-4 h-4 ${isLoading ? "animate-spin-slow" : ""}`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Meta line */}
            <div className="mx-6 mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Live</span>
              <span className="text-neutral-300">&middot;</span>
              <span>Gemini 2.5 Flash-Lite</span>
              {updatedLabel && (
                <>
                  <span className="text-neutral-300">&middot;</span>
                  <span>{updatedLabel}</span>
                </>
              )}
            </div>

            {/* Content area */}
            <div className="flex-1 min-h-0 overflow-y-auto prayer-scrollbar px-6 pb-6 mt-5 break-words">
              {isLoading && !prayerBrief && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <Spinner className="h-6 w-6" />
                  <p className="text-sm text-neutral-400">Generating brief…</p>
                </div>
              )}

              {!isLoading && errorMessage && (
                <ErrorState message={errorMessage} />
              )}

              {prayerBrief && (
                <>
                  {renderPrayerBrief(prayerBrief.text)}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Navigation links */}
      <nav className={`absolute bottom-6 left-6 z-20 flex gap-3 transition-opacity duration-300 ${isPanelOpen ? "max-lg:opacity-0 max-lg:pointer-events-none" : ""}`}>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          Original Globe
        </Link>
        <Link
          href="/new"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          New Globe
        </Link>
        <Link
          href="/new-2"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          GitHub Globe
        </Link>
      </nav>

      {/* Instructions */}
      <div className={`absolute bottom-20 left-6 z-20 text-sm text-gray-500 transition-opacity duration-300 ${isPanelOpen ? "max-lg:opacity-0 max-lg:pointer-events-none" : ""}`}>
        <p>Click a country to select</p>
        <p className="text-xs mt-1">Drag to rotate · Pinch to zoom</p>
      </div>
    </main>
  );
}

/* ─── Sub-components ─── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-10 h-10 text-neutral-300"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.733-3.559"
        />
      </svg>
      <p className="text-sm text-neutral-400">Select a country on the globe</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-5">
      <p className="text-sm font-medium text-neutral-800">
        Unable to load prayer brief
      </p>
      <p className="mt-2 text-sm text-neutral-500">{message}</p>
    </div>
  );
}



/* ─── Types ─── */

interface Source {
  url: string;
  title?: string;
}

interface PrayerBrief {
  country: string;
  updatedAt: string;
  text: string;
  sources: Source[];
}

/* ─── SSE parsing (unchanged) ─── */

function parseSseChunk(chunk: string) {
  const lines = chunk.split("\n");
  let event = "message";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  return { event, data };
}

/* ─── Citation utilities ─── */

function stripMarkdown(text: string): string {
  // Remove bold markers (**), keeping content between them
  return text.replace(/\*\*/g, "");
}

function stripInlineCitations(text: string): { clean: string; urls: string[] } {
  const urls: string[] = [];
  let counter = 0;

  // Strip markdown bold markers first
  let clean = stripMarkdown(text);

  // Strip markdown link citations like ([label](url)) or [label](url)
  clean = clean.replace(
    /\(?\[([^\]]*)\]\((https?:\/\/[^)]+)\)\)?/g,
    (_match, _label: string, url: string) => {
      urls.push(url);
      counter++;
      return `[${counter}]`;
    }
  );

  return { clean, urls };
}

function renderInlineCitations(text: string): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      return (
        <sup key={i} className="citation-sup">
          {match[1]}
        </sup>
      );
    }
    return part;
  });
}

/* ─── Rendering functions ─── */

function renderPrayerBrief(text: string) {
  const { clean } = stripInlineCitations(text);
  const sections = splitPrayerSections(clean);

  if (!sections.length) {
    return (
      <p className="whitespace-pre-line leading-7 text-sm text-neutral-700">
        {renderInlineCitations(clean)}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((section, index) => {
        const delayClass = ANIMATION_DELAYS[index] ?? ANIMATION_DELAYS[ANIMATION_DELAYS.length - 1];
        return (
          <section
            key={section.title ?? `section-${index}`}
            className={`rounded-2xl bg-neutral-50 border border-neutral-200/60 p-6 animate-fade-in-up ${delayClass}`}
          >
            {section.title && (
              <h3 className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400 mb-4">
                {section.title}
              </h3>
            )}
            {renderSectionContent(section.text)}
          </section>
        );
      })}
    </div>
  );
}

function splitPrayerSections(text: string) {
  const headings = ["Snapshot:", "Prayer Focus:", "Hope & Help:"];
  const markers = headings
    .map((heading) => ({
      heading,
      index: text.toLowerCase().indexOf(heading.toLowerCase()),
    }))
    .filter((marker) => marker.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (!markers.length) {
    return [
      {
        title: null,
        text,
      },
    ];
  }

  return markers.map((marker, index) => {
    const start = marker.index + marker.heading.length;
    const end =
      index < markers.length - 1 ? markers[index + 1].index : text.length;
    const sectionText = text.slice(start, end).trim();

    return {
      title: marker.heading.replace(":", ""),
      text: sectionText,
    };
  });
}

function renderSectionContent(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const bulletLines = lines.filter((line) => /^[-•*]\s+/.test(line));
  const nonBulletLines = lines.filter((line) => !/^[-•*]\s+/.test(line));

  // Pure bullet list
  if (bulletLines.length > 0 && nonBulletLines.length === 0) {
    return (
      <ul className="space-y-2.5">
        {bulletLines.map((line, index) => (
          <li key={`bullet-${index}`} className="flex items-start gap-3">
            <span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
            <span className="text-sm leading-7 text-neutral-700">
              {renderInlineCitations(line.replace(/^[-•*]\s+/, ""))}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // Mixed content: paragraphs + bullets
  if (bulletLines.length > 0) {
    return (
      <div className="space-y-3">
        {nonBulletLines.length > 0 && (
          <p className="text-sm leading-7 text-neutral-700">
            {renderInlineCitations(nonBulletLines.join(" "))}
          </p>
        )}
        <ul className="space-y-2.5">
          {bulletLines.map((line, index) => (
            <li key={`bullet-${index}`} className="flex items-start gap-3">
              <span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
              <span className="text-sm leading-7 text-neutral-700">
                {renderInlineCitations(line.replace(/^[-•*]\s+/, ""))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p className="text-sm leading-7 text-neutral-700">
      {renderInlineCitations(lines.join(" "))}
    </p>
  );
}
