"use client";

import { useState, FormEvent } from "react";

const SOURCES = ["manual", "olx", "otodom", "allegro", "sprzedajemy"] as const;

export default function AddWatchUrl() {
  const [url,    setUrl]    = useState("");
  const [source, setSource] = useState<typeof SOURCES[number]>("manual");
  const [label,  setLabel]  = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/watch-urls", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim(), source, label: label.trim() || null }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Unknown error");
        return;
      }

      setStatus("success");
      setMessage("Watch URL added. The worker will pick it up on its next run.");
      setUrl("");
      setLabel("");
    } catch (err) {
      setStatus("error");
      setMessage(String(err));
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <form className="watch-form" onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="https://www.olx.pl/d/oferta/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <select value={source} onChange={(e) => setSource(e.target.value as typeof SOURCES[number])}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ maxWidth: 180 }}
        />
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Adding..." : "Add watch URL"}
        </button>
      </form>
      {status === "success" && <p className="success-msg">{message}</p>}
      {status === "error"   && <p className="error-msg">{message}</p>}
    </div>
  );
}
