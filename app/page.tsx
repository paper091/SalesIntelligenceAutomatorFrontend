"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Pre-filled so the form isn't empty on first load - just a mix of URLs and
// plain company names to show off both intake paths.
const SAMPLE_LEADS = `https://www.houstonroofingonline.com
Bright Play Turf - Artificial Turf & Landscaping, Chicago IL
https://www.springhilllandscaping.com
Joe's Backyard Landscaping - Phoenix AZ
https://www.centraltexasbarkery.com
Sunrise Plumbing & Drain Services - Tampa FL
https://www.denverlockandsafe.com
Green Leaf Lawn Care - Columbus OH
https://www.redtruckbakery.com
Blue Ridge HVAC Services - Roanoke VA
Acme Roofing & Construction - Dallas TX
https://www.bostonplumbing.com
Pacific Northwest Tree Care - Portland OR
Maple Street Auto Repair - Madison WI
https://www.piedmontmoving.com`;

type StatusFilter = "all" | "pending" | "processing" | "done" | "failed";
type B2bFilter = "all" | "yes" | "no" | "unknown";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type SortBy = "recency" | "confidence";
type SortDir = "asc" | "desc";

// Lets us sort the "Confidence" column even though it's a string field.
const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recency", label: "Last Updated" },
  { value: "confidence", label: "Confidence" },
];

export default function Home() {
  const [leadsText, setLeadsText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [b2bFilter, setB2bFilter] = useState<B2bFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recency");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the sort popover when clicking anywhere outside it.
  useEffect(() => {
    if (!sortMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortMenuOpen]);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  async function fetchLeads() {
    try {
      const res = await fetch(`${API_URL}/api/leads`);
      if (!res.ok) return;
      const data: LeadResult[] = await res.json();
      setResults(data);

      // Once every lead has finished (or failed), stop polling - there's
      // nothing left that's going to change.
      const stillWorking = data.some(
        (l) => l.status === "pending" || l.status === "processing"
      );
      if (!stillWorking && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
      }
    } catch {
      // ignore transient polling errors
    }
  }

  useEffect(() => {
    fetchLeads();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun() {
    setError(null);
    setRunning(true);

    try {
      const form = new FormData();
      if (file) {
        form.append("file", file);
      } else {
        form.append("leads", leadsText);
      }

      const res = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${res.status}`);
      }

      await fetchLeads();

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchLeads, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunning(false);
    }
  }

  async function handleClearHistory() {
    if (!confirm("Clear all lead history? This cannot be undone.")) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/leads`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setRunning(false);
      setSelectedId(null);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleDownloadExcel() {
    window.location.href = `${API_URL}/api/leads/export`;
  }

  // Accept a .txt/.csv dropped onto the textarea, same as picking one.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && /\.(txt|csv)$/i.test(dropped.name)) {
      setFile(dropped);
    }
  }

  // Apply the status/B2B/confidence filters before sorting, so the sort
  // and the "X of Y leads" count both reflect what's actually shown.
  const filteredResults = useMemo(() => {
    return results.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;

      if (b2bFilter !== "all") {
        if (!lead.brief) {
          if (b2bFilter !== "unknown") return false;
        } else if (b2bFilter === "yes" && !lead.brief.b2b_qualified) {
          return false;
        } else if (b2bFilter === "no" && lead.brief.b2b_qualified) {
          return false;
        } else if (b2bFilter === "unknown") {
          return false;
        }
      }

      if (confidenceFilter !== "all") {
        if (!lead.brief || lead.brief.confidence !== confidenceFilter) return false;
      }

      return true;
    });
  }, [results, statusFilter, b2bFilter, confidenceFilter]);

  // Copy before sorting so we don't mutate the memoized filtered array.
  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    sorted.sort((a, b) => {
      let cmp: number;
      if (sortBy === "confidence") {
        const aRank = a.brief ? CONFIDENCE_RANK[a.brief.confidence] ?? -1 : -1;
        const bRank = b.brief ? CONFIDENCE_RANK[b.brief.confidence] ?? -1 : -1;
        cmp = aRank - bRank;
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredResults, sortBy, sortDir]);

  // Let Escape close the detail modal, same as clicking outside it.
  useEffect(() => {
    if (!selectedId) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedId]);

  const selected = results.find((r) => r.id === selectedId) || null;

  return (
    <div className="container">
      <div className="header-row">
        <div>
          <h1>Sales Intelligence Automator</h1>
          <p>
            Paste leads (one per line) — company names or URLs — or upload a .txt/.csv file,
            then click Run.
          </p>
        </div>
        <button onClick={toggleTheme} type="button" className="icon" title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      <div
        className={`dropzone ${dragActive ? "drag-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <textarea
          value={leadsText}
          onChange={(e) => setLeadsText(e.target.value)}
          disabled={!!file}
          placeholder="Paste leads here, one per line - or click 'Load sample leads' below."
        />
        {dragActive && <div className="drop-overlay">Drop .txt or .csv to upload</div>}
      </div>

      <div className="toolbar">
        <button onClick={() => setLeadsText(SAMPLE_LEADS)} type="button">
          Load sample leads
        </button>

        {file ? (
          <div className="file-chip">
            <span className="file-icon" aria-hidden>📄</span>
            <span className="file-name" title={file.name}>{file.name}</span>
            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
            <button onClick={() => setFile(null)} type="button" className="file-remove" aria-label="Remove file">
              ✕
            </button>
          </div>
        ) : (
          <label className="upload-btn">
            <span className="upload-icon" aria-hidden>⬆</span>
            Upload .txt / .csv
            <input
              type="file"
              accept=".txt,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              hidden
            />
          </label>
        )}

        <button onClick={handleRun} disabled={running} className="primary">
          {running ? "Running..." : "Run"}
        </button>
        <button onClick={handleDownloadExcel} disabled={results.length === 0} type="button">
          Download Excel
        </button>
        <button
          onClick={handleClearHistory}
          disabled={results.length === 0}
          type="button"
          className="danger"
        >
          Clear History
        </button>
      </div>

      {error && <p className="error-text">Error: {error}</p>}

      {results.length > 0 && (
        <div className="filters">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="done">Done</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label>
            B2B
            <select
              value={b2bFilter}
              onChange={(e) => setB2bFilter(e.target.value as B2bFilter)}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            Confidence
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <span className="sort-label">Sort by</span>
          <div className="sort-menu" ref={sortMenuRef}>
            <button
              type="button"
              className="sort-trigger"
              onClick={() => setSortMenuOpen((open) => !open)}
            >
              <span className="sort-trigger-value">
                {SORT_BY_OPTIONS.find((o) => o.value === sortBy)?.label}
              </span>
              <span className="chevron">{sortMenuOpen ? "▲" : "▼"}</span>
            </button>
            {sortMenuOpen && (
              <div className="sort-panel">
                {SORT_BY_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className={`sort-option ${sortBy === opt.value ? "selected" : ""}`}
                    onClick={() => setSortBy(opt.value)}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.value && <span className="check">✓</span>}
                  </div>
                ))}
                <div className="sort-divider" />
                <div
                  className={`sort-option ${sortDir === "asc" ? "selected" : ""}`}
                  onClick={() => setSortDir("asc")}
                >
                  <span>Asc</span>
                  {sortDir === "asc" && <span className="check">✓</span>}
                </div>
                <div
                  className={`sort-option ${sortDir === "desc" ? "selected" : ""}`}
                  onClick={() => setSortDir("desc")}
                >
                  <span>Desc</span>
                  {sortDir === "desc" && <span className="check">✓</span>}
                </div>
                <div className="sort-divider" />
                <button
                  type="button"
                  className="primary sort-apply"
                  onClick={() => setSortMenuOpen(false)}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          <span className="result-count">
            {filteredResults.length} of {results.length} leads
          </span>
        </div>
      )}

      {results.length > 0 && (
        sortedResults.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Resolved URL</th>
                <th>Status</th>
                <th>B2B?</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((lead) => (
                <tr
                  key={lead.id}
                  className="clickable"
                  onClick={() => setSelectedId(lead.id)}
                >
                  <td>{lead.input.name || lead.input.url || lead.input.raw}</td>
                  <td>{lead.resolved_url || "N/A"}</td>
                  <td>
                    <span className={`badge ${lead.status}`}>{lead.status}</span>
                  </td>
                  <td>
                    {lead.brief ? (lead.brief.b2b_qualified ? "Yes" : "No") : "-"}
                  </td>
                  <td>
                    {lead.brief?.confidence ? (
                      <span className={`confidence ${lead.brief.confidence}`}>
                        {lead.brief.confidence}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No leads match the current filters.</div>
        )
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelectedId(null)}>
          <div className="detail modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon modal-close"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
            <h3>{selected.input.name || selected.input.url || selected.input.raw}</h3>
            <p>
              <strong>Status:</strong> {selected.status}
              {selected.resolved_url && (
                <>
                  {" "}
                  | <strong>URL:</strong> {selected.resolved_url}
                </>
              )}
            </p>

            {selected.error && <p className="error-text">Error: {selected.error}</p>}

            {selected.brief && (
              <>
                <p><strong>Company Overview:</strong> {selected.brief.company_overview}</p>
                <p><strong>Core Product/Service:</strong> {selected.brief.core_product_or_service}</p>
                <p><strong>Target Customer:</strong> {selected.brief.target_customer}</p>
                <p>
                  <strong>B2B Qualified:</strong> {selected.brief.b2b_qualified ? "Yes" : "No"}
                  {" — "}
                  {selected.brief.b2b_reasoning}
                </p>
                {selected.brief.b2b_signals?.length > 0 && (
                  <p>
                    <strong>B2B Signals:</strong>{" "}
                    {selected.brief.b2b_signals.map((s, i) => (
                      <span key={i} className="signal-tag">{s}</span>
                    ))}
                  </p>
                )}
                <p><strong>Sales Questions:</strong></p>
                <ul>
                  {selected.brief.sales_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
                <p><strong>Confidence:</strong> {selected.brief.confidence}</p>
                {selected.brief.evidence_note && (
                  <p><strong>Evidence Note:</strong> {selected.brief.evidence_note}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
