"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Theme = "dark" | "light";
type SaveType = "notion" | "webhook";

interface SaveConfig {
  type: SaveType;
  notionToken?: string;
  notionPageId?: string;
  webhookUrl?: string;
}

// ─── Data: 8 sections ────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "Part 1", icon: "⚡", title: "一分钟复盘",     group: "核心洞察" },
  { key: "Part 2", icon: "💡", title: "关键事实与观点", group: "核心洞察" },
  { key: "Part 3", icon: "🤝", title: "达成共识",       group: "核心洞察" },
  { key: "Part 4", icon: "✅", title: "行动计划",        group: "行动追踪" },
  { key: "Part 5", icon: "❓", title: "未解决问题",     group: "行动追踪" },
  { key: "Part 6", icon: "👤", title: "关系经营洞察",   group: "深度沉淀" },
  { key: "Part 7", icon: "🚀", title: "机会与风险",     group: "深度沉淀" },
  { key: "Part 8", icon: "🔍", title: "反思与下次备忘", group: "深度沉淀" },
] as const;

const GROUPS = [
  {
    name: "核心洞察",
    accent: "#6366f1",
    bg: "rgba(99,102,241,0.07)",
    border: "rgba(99,102,241,0.2)",
    bgLight: "rgba(99,102,241,0.04)",
    borderLight: "rgba(99,102,241,0.18)",
    desc: "快速还原会议全貌，提炼关键信息与共识",
  },
  {
    name: "行动追踪",
    accent: "#8b5cf6",
    bg: "rgba(139,92,246,0.07)",
    border: "rgba(139,92,246,0.2)",
    bgLight: "rgba(139,92,246,0.04)",
    borderLight: "rgba(139,92,246,0.18)",
    desc: "确保每个承诺都有人跟进，每个问题都有出口",
  },
  {
    name: "深度沉淀",
    accent: "#f472b6",
    bg: "rgba(244,114,182,0.07)",
    border: "rgba(244,114,182,0.2)",
    bgLight: "rgba(244,114,182,0.04)",
    borderLight: "rgba(244,114,182,0.18)",
    desc: "关系经营、机会识别与持续学习闭环",
  },
] as const;

const GROUP_ACCENT: Record<string, string> = Object.fromEntries(
  GROUPS.map((g) => [g.name, g.accent])
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function suggestTopic(output: string): string {
  const sections = parseSections(output);
  const part1 = sections.find((s) => s.title.startsWith("Part 1"));
  if (!part1) return "";
  const lines = part1.content.split("\n");
  for (const line of lines) {
    if (line.includes("核心目标")) {
      const m = line.match(/[：:]\s*(.+)/);
      if (m) {
        const val = m[1].replace(/\*\*(.+?)\*\*/g, "$1").trim();
        return val.length > 28 ? val.slice(0, 28) + "…" : val;
      }
    }
  }
  for (const line of lines) {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const m = line.match(/[：:]\s*(.+)/);
      if (m) {
        const val = m[1].replace(/\*\*(.+?)\*\*/g, "$1").trim();
        return val.length > 28 ? val.slice(0, 28) + "…" : val;
      }
    }
  }
  return "";
}

function getSectionMeta(title: string) {
  const found = SECTIONS.find((s) => title.startsWith(s.key));
  return found ?? { icon: "📌", title, group: "", key: "" };
}

function stripPartPrefix(title: string) {
  const match = title.match(/^Part \d+[：:]\s*(.+?)(?:（[^）]*）)?$/);
  return match ? match[1].trim() : title;
}

function parseSections(text: string) {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split("\n");
  let current: { title: string; content: string } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.replace("## ", "").trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ dark }: { dark: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: dark
          ? "linear-gradient(135deg, #1e1b4b 0%, #0f0e1a 100%)"
          : "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
        border: dark ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(99,102,241,0.22)",
        boxShadow: dark ? "0 0 16px rgba(99,102,241,0.18)" : "0 1px 4px rgba(99,102,241,0.12)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5 L9.3 6.7 L14.5 8 L9.3 9.3 L8 14.5 L6.7 9.3 L1.5 8 L6.7 6.7 Z"
          fill={dark ? "#a5b4fc" : "#6366f1"}
        />
      </svg>
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string, dark: boolean) {
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let inTable = false;
  let k = 0;

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines.forEach((l) => els.push(<p key={k++} className={dark ? "text-slate-400 text-sm mb-1" : "text-gray-500 text-sm mb-1"}>{l}</p>));
      tableLines = [];
      return;
    }
    const headers = tableLines[0].split("|").map((h) => h.trim()).filter(Boolean);
    const rows = tableLines.slice(2).map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));
    els.push(
      <div key={k++} className="overflow-x-auto mb-5 mt-3 rounded-xl" style={{ border: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-2.5 text-left font-medium text-xs ${dark ? "text-slate-300" : "text-gray-600"}`}
                  style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-2.5 text-xs ${dark ? "text-slate-400" : "text-gray-500"}`}
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  for (const line of lines) {
    if (line.startsWith("|")) { inTable = true; tableLines.push(line); continue; }
    else if (inTable) { flushTable(); inTable = false; }

    if (line.startsWith("### ")) {
      els.push(<h3 key={k++} className={`font-semibold mt-5 mb-2 text-sm ${dark ? "text-slate-200" : "text-gray-700"}`}>{line.replace("### ", "")}</h3>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const html = line.replace(/^[-•]\s/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      els.push(
        <div key={k++} className="flex gap-2.5 mb-2">
          <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${dark ? "bg-slate-600" : "bg-gray-300"}`} />
          <span className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-gray-600"}`} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.+)/);
      if (m) {
        const html = m[2].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        els.push(
          <div key={k++} className="flex gap-2.5 mb-2">
            <span className={`text-xs shrink-0 mt-0.5 w-5 text-right ${dark ? "text-slate-500" : "text-gray-400"}`}>{m[1]}.</span>
            <span className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-gray-600"}`} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      }
    } else if (line.trim() === "") {
      els.push(<div key={k++} className="h-1.5" />);
    } else if (line.trim()) {
      const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      els.push(<p key={k++} className={`text-sm mb-1.5 leading-relaxed ${dark ? "text-slate-300" : "text-gray-600"}`} dangerouslySetInnerHTML={{ __html: html }} />);
    }
  }
  if (inTable) flushTable();
  return els;
}

// ─── Dimension Map ────────────────────────────────────────────────────────────
function DimensionMap({ dark }: { dark: boolean }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-8 py-12">
      <div className="text-center mb-10">
        <div className="text-3xl mb-3 opacity-60">✦</div>
        <h2 className={`text-lg font-semibold mb-2 ${dark ? "text-slate-200" : "text-gray-800"}`}>粘贴会议内容，开始复盘</h2>
        <p className={`text-sm ${dark ? "text-slate-500" : "text-gray-400"}`}>3 大维度 · 9 个模块，让每次会议成为可积累的长期资产</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {GROUPS.map((group) => {
          const items = SECTIONS.filter((s) => s.group === group.name);
          return (
            <div key={group.name} className="rounded-2xl p-4"
              style={{ background: dark ? group.bg : group.bgLight, border: `1px solid ${dark ? group.border : group.borderLight}` }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.accent }} />
                <span className="text-sm font-semibold" style={{ color: group.accent }}>{group.name}</span>
              </div>
              <p className={`text-xs mb-3 leading-relaxed ${dark ? "text-slate-500" : "text-gray-400"}`}>{group.desc}</p>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="text-sm">{s.icon}</span>
                    <span className={`text-xs ${dark ? "text-slate-400" : "text-gray-500"}`}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progress Tracker ─────────────────────────────────────────────────────────
function ProgressTracker({
  completedKeys, dark, onSectionClick, onGroupClick,
}: {
  completedKeys: Set<string>;
  dark: boolean;
  onSectionClick: (key: string) => void;
  onGroupClick: (groupName: string) => void;
}) {
  const total = SECTIONS.length;
  const done = completedKeys.size;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs ${dark ? "text-slate-500" : "text-gray-400"}`}>复盘进度</span>
        <span className={`text-xs ${dark ? "text-slate-500" : "text-gray-400"}`}>{done}/{total}</span>
      </div>
      <div className={`h-1 rounded-full overflow-hidden mb-3 ${dark ? "bg-slate-800" : "bg-gray-200"}`}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #f472b6)" }} />
      </div>
      <div className="space-y-3">
        {GROUPS.map((group) => {
          const items = SECTIONS.filter((s) => s.group === group.name);
          const groupDone = items.filter((s) => completedKeys.has(s.key)).length;
          return (
            <div key={group.name}>
              <button
                onClick={() => onGroupClick(group.name)}
                className="flex items-center gap-1.5 mb-1.5 w-full text-left hover:opacity-80 transition-opacity"
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.accent }} />
                <span className="text-xs font-medium" style={{ color: group.accent }}>{group.name}</span>
                <span className={`text-xs ml-auto ${dark ? "text-slate-700" : "text-gray-300"}`}>{groupDone}/{items.length}</span>
              </button>
              <div className="flex flex-wrap gap-1">
                {items.map((s) => {
                  const isDone = completedKeys.has(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => isDone && onSectionClick(s.key)}
                      className={`text-xs px-1.5 py-0.5 rounded transition-all ${isDone ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
                      style={{
                        background: isDone ? `${group.accent}18` : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                        color: isDone ? group.accent : (dark ? "#475569" : "#9ca3af"),
                        border: `1px solid ${isDone ? group.accent + "35" : (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)")}`,
                      }}
                    >
                      {s.icon} {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Save Panel ───────────────────────────────────────────────────────────────
const SAVE_CONFIG_KEY = "meeting-debrief-save-config";

function SavePanel({ output, dark, suggestedTopic }: { output: string; dark: boolean; suggestedTopic: string }) {
  const [open, setOpen] = useState(false);
  const [saveType, setSaveType] = useState<SaveType>("notion");
  const [notionToken, setNotionToken] = useState("");
  const [notionPageUrl, setNotionPageUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [topicEdited, setTopicEdited] = useState(false);
  const [remember, setRemember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVE_CONFIG_KEY);
      if (stored) {
        const cfg: SaveConfig = JSON.parse(stored);
        setSaveType(cfg.type ?? "notion");
        if (cfg.notionToken) setNotionToken(cfg.notionToken);
        if (cfg.notionPageId) setNotionPageUrl(cfg.notionPageId);
        if (cfg.webhookUrl) setWebhookUrl(cfg.webhookUrl);
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (suggestedTopic && !topicEdited) setTopic(suggestedTopic);
  }, [suggestedTopic, topicEdited]);

  const extractPageId = (url: string): string => {
    const m = url.match(/([a-f0-9]{32})/i) ?? url.match(/([a-f0-9-]{36})/i);
    return m ? m[1].replace(/-/g, "") : url.trim();
  };

  const handleSave = async () => {
    if (!output.trim()) return;
    setSaving(true); setSaveError(""); setSaved(null);
    const date = new Date().toISOString().slice(0, 10);
    const title = `${date} · ${topic.trim() || "会议复盘"}`;
    try {
      if (saveType === "notion") {
        const pageId = extractPageId(notionPageUrl);
        if (remember) localStorage.setItem(SAVE_CONFIG_KEY, JSON.stringify({ type: "notion", notionToken, notionPageId: notionPageUrl } as SaveConfig));
        else localStorage.removeItem(SAVE_CONFIG_KEY);
        const res = await fetch("/api/save-notion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: output, title, notionToken, parentPageId: pageId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSaved(data.url);
      } else {
        if (remember) localStorage.setItem(SAVE_CONFIG_KEY, JSON.stringify({ type: "webhook", webhookUrl } as SaveConfig));
        else localStorage.removeItem(SAVE_CONFIG_KEY);
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, markdown: output, timestamp: new Date().toISOString() }),
        });
        if (!res.ok) throw new Error(`Webhook 返回 ${res.status}`);
        setSaved("ok");
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    } finally { setSaving(false); }
  };

  const canSave = saveType === "notion"
    ? notionToken.trim().length > 0 && notionPageUrl.trim().length > 0
    : webhookUrl.trim().length > 0;

  const inputCls = dark
    ? "w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
    : "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400/60 transition-colors";

  return (
    <div className={`rounded-xl p-3 space-y-2 ${dark ? "bg-white/[0.02] border border-white/[0.07]" : "bg-white border border-gray-100 shadow-sm"}`}>
      <button className="flex items-center justify-between w-full" onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-1.5">
          <span>📥</span>
          <span className={`text-xs font-medium ${dark ? "text-slate-300" : "text-gray-700"}`}>保存笔记</span>
          <span className={`text-xs ${dark ? "text-slate-600" : "text-gray-400"}`}>（可选）</span>
        </span>
        <span className={`text-xs ${dark ? "text-slate-600" : "text-gray-300"}`}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-2.5 pt-1">
          <div className="flex gap-2">
            {([["notion", "📝 Notion"], ["webhook", "🔗 自定义"]] as [SaveType, string][]).map(([type, label]) => (
              <button key={type} onClick={() => setSaveType(type)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                  saveType === type
                    ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                    : dark ? "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
                           : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}>{label}</button>
            ))}
          </div>

          {saveType === "notion" && (
            <div className="space-y-2">
              <input value={notionToken} onChange={(e) => setNotionToken(e.target.value)}
                placeholder="Integration Token（secret_...）" className={inputCls} />
              <input value={notionPageUrl} onChange={(e) => setNotionPageUrl(e.target.value)}
                placeholder="父页面 URL 或 Page ID" className={inputCls} />
            </div>
          )}
          {saveType === "webhook" && (
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="POST Endpoint URL" className={inputCls} />
          )}

          <input value={topic} onChange={(e) => { setTopic(e.target.value); setTopicEdited(true); }}
            placeholder="会议主题（用于标题，可选）" className={inputCls} />

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
            <span className={`text-xs ${dark ? "text-slate-500" : "text-gray-400"}`}>记住账号信息</span>
          </label>

          {saved ? (
            saved === "ok"
              ? <p className="text-xs text-green-400">✓ 已发送到自定义端点</p>
              : <a href={saved} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:text-green-300 transition-colors">✓ 已保存，点击打开 →</a>
          ) : (
            <button onClick={handleSave} disabled={saving || !canSave}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5">
              {saving ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />保存中...</> : "保存"}
            </button>
          )}
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const THEME_KEY = "meeting-debrief-theme";

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [content, setContent] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const toggleTheme = () => {
    const next: Theme = dark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const exportMarkdown = useCallback(() => {
    if (!output) return;
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([`# 会议复盘 ${date}\n\n${output}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meeting-debrief-${date}.md`; a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const scrollToSection = useCallback((key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (el && outputRef.current) {
      const containerRect = outputRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + outputRef.current.scrollTop - 20;
      outputRef.current.scrollTo({ top: offset, behavior: "smooth" });
    }
  }, []);

  const scrollToGroup = useCallback((groupName: string) => {
    const firstKey = SECTIONS.find((s) => s.group === groupName)?.key;
    if (firstKey) scrollToSection(firstKey);
  }, [scrollToSection]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true); setOutput(""); setError(""); setDone(false);
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "请求失败");
        setLoading(false);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
      }
      setDone(true);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const sections = output ? parseSections(output) : [];
  const suggestedTopicVal = done ? suggestTopic(output) : "";
  const completedKeys = new Set(sections.map((s) => getSectionMeta(s.title).key).filter(Boolean));
  const showOutput = sections.length > 0;

  const btnGhost = dark
    ? "text-xs text-slate-500 hover:text-slate-200 px-2.5 py-1 rounded-lg border border-white/[0.07] hover:border-white/[0.15] transition-all"
    : "text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-gray-300 transition-all";

  return (
    <div className={dark ? "min-h-screen bg-[#0d0c10] text-white flex flex-col" : "min-h-screen bg-[#fafaf9] text-gray-900 flex flex-col"}
      style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <header className={`px-6 py-3.5 flex items-center justify-between shrink-0 ${dark ? "border-b border-white/[0.07]" : "border-b border-gray-100 bg-white"}`}>
        <div className="flex items-center gap-3">
          <Logo dark={dark} />
          <div>
            <span className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Meeting Debrief</span>
            <span className={`mx-2 ${dark ? "text-slate-700" : "text-gray-200"}`}>·</span>
            <span className={`text-xs ${dark ? "text-slate-500" : "text-gray-400"}`}>会议复盘 · 知识沉淀 · 后续行动生成器</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={btnGhost}>{dark ? "☀️ 浅色" : "🌙 深色"}</button>
          {done && (
            <>
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">✓ 复盘完成</span>
              <button onClick={() => copyToClipboard(output, "all")} className={btnGhost}>{copied === "all" ? "✓ 已复制" : "复制全文"}</button>
              <button onClick={exportMarkdown} className={btnGhost}>导出 .md</button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`w-64 shrink-0 flex flex-col p-4 gap-3 overflow-y-auto ${dark ? "border-r border-white/[0.07]" : "border-r border-gray-100 bg-white"}`}>
          <div className="flex flex-col flex-1 gap-1.5">
            <label className={`text-xs font-medium ${dark ? "text-slate-500" : "text-gray-400"}`}>会议内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"粘贴任意内容即可\n\n· 录音转写文本\n· 手写 / 口述笔记\n· 聊天记录文字\n· 邮件往来\n· 会议纪要草稿\n· 多种混合均可"}
              className={`flex-1 rounded-xl p-3.5 text-sm resize-none focus:outline-none transition-colors leading-relaxed ${
                dark
                  ? "bg-white/[0.03] border border-white/[0.07] text-slate-200 placeholder-slate-600 focus:border-indigo-500/40"
                  : "bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-indigo-400/50"
              }`}
              style={{ minHeight: "260px" }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className={`w-full py-2.5 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
              loading || !content.trim()
                ? dark ? "bg-white/[0.05] text-slate-600" : "bg-gray-200 text-gray-400"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />正在复盘...</>
              : "✦  开始会议复盘"}
          </button>

          {(content || output) && (
            <button
              onClick={() => { setContent(""); setOutput(""); setDone(false); setError(""); }}
              className={`w-full py-1.5 text-xs transition-colors ${dark ? "text-slate-700 hover:text-slate-400" : "text-gray-300 hover:text-gray-500"}`}
            >清空重置</button>
          )}

          {error && <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg p-3">{error}</div>}

          {(loading || done) && (
            <ProgressTracker
              completedKeys={completedKeys}
              dark={dark}
              onSectionClick={scrollToSection}
              onGroupClick={scrollToGroup}
            />
          )}
          {done && <SavePanel output={output} dark={dark} suggestedTopic={suggestedTopicVal} />}
        </div>

        {/* Right Panel */}
        <div ref={outputRef} className="flex-1 overflow-y-auto">
          {!showOutput && !loading && <DimensionMap dark={dark} />}

          {loading && !showOutput && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className={`w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3 ${dark ? "border-indigo-500/30 border-t-indigo-400" : "border-indigo-300 border-t-indigo-500"}`} />
                <p className={`text-sm ${dark ? "text-slate-500" : "text-gray-400"}`}>正在分析会议内容…</p>
              </div>
            </div>
          )}

          {showOutput && (
            <div className="px-10 py-8 space-y-4">
              {sections.map((section, i) => {
                const meta = getSectionMeta(section.title);
                const displayTitle = stripPartPrefix(section.title);
                const isStreaming = loading && i === sections.length - 1;
                const accent = GROUP_ACCENT[meta.group] ?? "#6366f1";

                return (
                  <div
                    key={i}
                    id={`section-${meta.key}`}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: dark ? "rgba(255,255,255,0.02)" : "white",
                      border: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                      borderLeft: `3px solid ${accent}`,
                      boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-3 px-6 py-4">
                      <span className="text-lg">{meta.icon}</span>
                      <span className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{displayTitle}</span>
                      {meta.group && (
                        <span className="text-xs font-medium ml-1" style={{ color: `${accent}99` }}>{meta.group}</span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {isStreaming && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />}
                        {!loading && section.content.trim() && (
                          <button
                            onClick={() => copyToClipboard(`## ${section.title}\n\n${section.content}`, `s-${i}`)}
                            className={`text-xs transition-colors px-2 py-0.5 rounded ${dark ? "text-slate-600 hover:text-slate-300 hover:bg-white/[0.05]" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}
                          >
                            {copied === `s-${i}` ? "✓" : "复制"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`px-6 pb-5 ${dark ? "" : ""}`}>
                      {renderMarkdown(section.content, dark)}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className={`flex items-center gap-2 text-xs px-1 pb-4 ${dark ? "text-slate-700" : "text-gray-300"}`}>
                  <span className={`w-3 h-3 border rounded-full animate-spin ${dark ? "border-slate-700 border-t-slate-500" : "border-gray-300 border-t-gray-500"}`} />
                  继续生成中…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
