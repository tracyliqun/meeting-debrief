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

// ─── Data: 3 groups × 3 sections = 9 total ───────────────────────────────────
const SECTIONS = [
  { key: "Part 1", icon: "⚡", color: "#3b82f6", title: "一分钟复盘",     group: "核心洞察" },
  { key: "Part 2", icon: "💡", color: "#eab308", title: "关键事实与观点", group: "核心洞察" },
  { key: "Part 3", icon: "🤝", color: "#22c55e", title: "达成共识",       group: "核心洞察" },
  { key: "Part 4", icon: "✅", color: "#a855f7", title: "Action Items",   group: "行动追踪" },
  { key: "Part 5", icon: "❓", color: "#f97316", title: "未解决问题",     group: "行动追踪" },
  { key: "Part 6", icon: "➡️", color: "#10b981", title: "建议后续动作",  group: "行动追踪" },
  { key: "Part 7", icon: "👤", color: "#ec4899", title: "关系经营洞察",   group: "深度沉淀" },
  { key: "Part 8", icon: "🚀", color: "#06b6d4", title: "机会与风险",     group: "深度沉淀" },
  { key: "Part 9", icon: "🔍", color: "#f59e0b", title: "反思与下次备忘", group: "深度沉淀" },
] as const;

const GROUPS = [
  {
    name: "核心洞察",
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.06)",
    border: "rgba(59,130,246,0.2)",
    bgLight: "rgba(59,130,246,0.04)",
    borderLight: "rgba(59,130,246,0.25)",
    desc: "快速还原会议全貌，提炼关键信息与共识",
  },
  {
    name: "行动追踪",
    accent: "#a855f7",
    bg: "rgba(168,85,247,0.06)",
    border: "rgba(168,85,247,0.2)",
    bgLight: "rgba(168,85,247,0.04)",
    borderLight: "rgba(168,85,247,0.3)",
    desc: "确保每个承诺都有人跟进，每个问题都有出口",
  },
  {
    name: "深度沉淀",
    accent: "#ec4899",
    bg: "rgba(236,72,153,0.06)",
    border: "rgba(236,72,153,0.2)",
    bgLight: "rgba(236,72,153,0.04)",
    borderLight: "rgba(236,72,153,0.3)",
    desc: "关系经营、机会识别与持续学习闭环",
  },
] as const;

const GROUP_ACCENT: Record<string, string> = Object.fromEntries(
  GROUPS.map((g) => [g.name, g.accent])
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSectionMeta(title: string) {
  const found = SECTIONS.find((s) => title.startsWith(s.key));
  return found ?? { icon: "📌", color: "#64748b", title, group: "", key: "" };
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

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string, theme: Theme) {
  const dark = theme === "dark";
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let tableLines: string[] = [];
  let inTable = false;
  let k = 0;

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines.forEach((l) =>
        els.push(<p key={k++} className={dark ? "text-slate-300 text-sm mb-1" : "text-gray-600 text-sm mb-1"}>{l}</p>)
      );
      tableLines = [];
      return;
    }
    const headers = tableLines[0].split("|").map((h) => h.trim()).filter(Boolean);
    const rows = tableLines.slice(2).map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));
    els.push(
      <div key={k++} className="overflow-x-auto mb-4 mt-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className={dark ? "bg-slate-700/80" : "bg-gray-100"}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={dark
                    ? "border border-slate-600 px-3 py-2 text-left text-slate-200 font-medium text-xs"
                    : "border border-gray-300 px-3 py-2 text-left text-gray-700 font-medium text-xs"}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={dark
                ? (i % 2 === 0 ? "bg-slate-800/60" : "bg-slate-900/60")
                : (i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={dark
                      ? "border border-slate-700 px-3 py-2 text-slate-300 text-xs"
                      : "border border-gray-200 px-3 py-2 text-gray-600 text-xs"}
                  >
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
      els.push(
        <h3 key={k++} className={dark ? "text-slate-100 font-semibold mt-4 mb-2 text-sm" : "text-gray-800 font-semibold mt-4 mb-2 text-sm"}>
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const html = line.replace(/^[-•]\s/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      els.push(
        <div key={k++} className="flex gap-2 mb-1.5">
          <span className={dark ? "text-slate-500 mt-0.5 shrink-0 text-xs" : "text-gray-400 mt-0.5 shrink-0 text-xs"}>•</span>
          <span className={dark ? "text-slate-300 text-sm leading-relaxed" : "text-gray-600 text-sm leading-relaxed"} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.+)/);
      if (m) {
        const html = m[2].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        els.push(
          <div key={k++} className="flex gap-2 mb-1.5">
            <span className={dark ? "text-slate-500 text-xs shrink-0 mt-0.5" : "text-gray-400 text-xs shrink-0 mt-0.5"}>{m[1]}.</span>
            <span className={dark ? "text-slate-300 text-sm leading-relaxed" : "text-gray-600 text-sm leading-relaxed"} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      }
    } else if (line.trim() === "") {
      els.push(<div key={k++} className="h-2" />);
    } else if (line.trim()) {
      const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      els.push(
        <p key={k++} className={dark ? "text-slate-300 text-sm mb-1 leading-relaxed" : "text-gray-600 text-sm mb-1 leading-relaxed"} dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  }
  if (inTable) flushTable();
  return els;
}

// ─── Dimension Map (empty state) ─────────────────────────────────────────────
function DimensionMap({ theme }: { theme: Theme }) {
  const dark = theme === "dark";
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">✦</div>
        <h2 className={dark ? "text-slate-200 text-lg font-semibold mb-1" : "text-gray-800 text-lg font-semibold mb-1"}>
          粘贴会议内容，开始复盘
        </h2>
        <p className={dark ? "text-slate-500 text-sm" : "text-gray-400 text-sm"}>
          3 大维度 · 9 个分析模块，全链路覆盖，让每次会议成为可积累的长期资产
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {GROUPS.map((group) => {
          const items = SECTIONS.filter((s) => s.group === group.name);
          return (
            <div
              key={group.name}
              className="rounded-xl p-4"
              style={{
                background: dark ? group.bg : group.bgLight,
                border: `1px solid ${dark ? group.border : group.borderLight}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: group.accent }} />
                <span className="text-sm font-semibold" style={{ color: group.accent }}>{group.name}</span>
              </div>
              <p className={dark ? "text-xs text-slate-500 mb-3 leading-relaxed" : "text-xs text-gray-400 mb-3 leading-relaxed"}>
                {group.desc}
              </p>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <span className="text-sm w-5 text-center">{s.icon}</span>
                    <span className={dark ? "text-xs text-slate-400" : "text-xs text-gray-500"}>{s.title}</span>
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
function ProgressTracker({ completedKeys, theme }: { completedKeys: Set<string>; theme: Theme }) {
  const dark = theme === "dark";
  const total = SECTIONS.length;
  const done = completedKeys.size;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className={dark ? "text-xs text-slate-400" : "text-xs text-gray-500"}>复盘进度</span>
        <span className={dark ? "text-xs text-slate-400" : "text-xs text-gray-500"}>{done}/{total}</span>
      </div>
      <div className={dark ? "h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3" : "h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3"}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }}
        />
      </div>
      <div className="space-y-2.5">
        {GROUPS.map((group) => {
          const items = SECTIONS.filter((s) => s.group === group.name);
          const groupDone = items.filter((s) => completedKeys.has(s.key)).length;
          return (
            <div key={group.name}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.accent }} />
                <span className="text-xs font-medium" style={{ color: group.accent }}>{group.name}</span>
                <span className={dark ? "text-xs text-slate-600 ml-auto" : "text-xs text-gray-300 ml-auto"}>{groupDone}/{items.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {items.map((s) => {
                  const isDone = completedKeys.has(s.key);
                  return (
                    <span
                      key={s.key}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: isDone ? `${group.accent}20` : (dark ? "rgba(51,65,85,0.4)" : "rgba(229,231,235,0.8)"),
                        color: isDone ? group.accent : (dark ? "#64748b" : "#9ca3af"),
                        border: `1px solid ${isDone ? group.accent + "40" : (dark ? "rgba(51,65,85,0.6)" : "rgba(209,213,219,0.8)")}`,
                      }}
                    >
                      {s.icon} {s.title}
                    </span>
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

// ─── Save Panel (optional) ────────────────────────────────────────────────────
const SAVE_CONFIG_KEY = "meeting-debrief-save-config";

function SavePanel({ output, theme }: { output: string; theme: Theme }) {
  const dark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [saveType, setSaveType] = useState<SaveType>("notion");
  const [notionToken, setNotionToken] = useState("");
  const [notionPageUrl, setNotionPageUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [topic, setTopic] = useState("");
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
      }
    } catch { /* ignore */ }
  }, []);

  const extractPageId = (url: string): string => {
    const m = url.match(/([a-f0-9]{32})/i) ?? url.match(/([a-f0-9-]{36})/i);
    return m ? m[1].replace(/-/g, "") : url.trim();
  };

  const handleSave = async () => {
    if (!output.trim()) return;
    setSaving(true);
    setSaveError("");
    setSaved(null);

    const date = new Date().toISOString().slice(0, 10);
    const title = `${date} · ${topic.trim() || "会议复盘"}`;

    try {
      if (saveType === "notion") {
        const pageId = extractPageId(notionPageUrl);
        localStorage.setItem(SAVE_CONFIG_KEY, JSON.stringify({ type: "notion", notionToken, notionPageId: notionPageUrl } as SaveConfig));

        const res = await fetch("/api/save-notion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: output, title, notionToken, parentPageId: pageId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSaved(data.url);
      } else {
        localStorage.setItem(SAVE_CONFIG_KEY, JSON.stringify({ type: "webhook", webhookUrl } as SaveConfig));
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
    } finally {
      setSaving(false);
    }
  };

  const canSave = saveType === "notion"
    ? notionToken.trim().length > 0 && notionPageUrl.trim().length > 0
    : webhookUrl.trim().length > 0;

  const inputCls = dark
    ? "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors"
    : "w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors";

  return (
    <div className={dark ? "border border-slate-700/60 rounded-xl bg-slate-900/60 p-3 space-y-2" : "border border-gray-200 rounded-xl bg-gray-50 p-3 space-y-2"}>
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-1.5">
          <span>📥</span>
          <span className={dark ? "text-xs font-medium text-slate-300" : "text-xs font-medium text-gray-700"}>保存笔记</span>
          <span className={dark ? "text-xs text-slate-600" : "text-xs text-gray-400"}> （可选）</span>
        </span>
        <span className={dark ? "text-xs text-slate-600" : "text-xs text-gray-400"}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-2.5 pt-1">
          {/* Type selector */}
          <div className="flex gap-2">
            {([["notion", "📝 Notion"], ["webhook", "🔗 自定义"]] as [SaveType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setSaveType(type)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                  saveType === type
                    ? "border-blue-500/60 text-blue-400 bg-blue-500/10"
                    : dark
                      ? "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Notion config */}
          {saveType === "notion" && (
            <div className="space-y-2">
              <input
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="Integration Token（secret_...）"
                className={inputCls}
              />
              <input
                value={notionPageUrl}
                onChange={(e) => setNotionPageUrl(e.target.value)}
                placeholder="父页面 URL 或 Page ID"
                className={inputCls}
              />
            </div>
          )}

          {/* Webhook config */}
          {saveType === "webhook" && (
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="POST Endpoint URL"
              className={inputCls}
            />
          )}

          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="会议主题（用于标题，可选）"
            className={inputCls}
          />

          {saved ? (
            saved === "ok" ? (
              <p className="text-xs text-green-400">✓ 已发送到自定义端点</p>
            ) : (
              <a
                href={saved}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
              >
                ✓ 已保存到 Notion →
              </a>
            )
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />保存中...</>
              ) : "保存"}
            </button>
          )}
          {saveError && <p className="text-xs text-red-400 leading-relaxed">{saveError}</p>}
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
    a.href = url;
    a.download = `meeting-debrief-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setOutput("");
    setError("");
    setDone(false);

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
  const completedKeys = new Set(
    sections.map((s) => getSectionMeta(s.title).key).filter(Boolean)
  );
  const showOutput = sections.length > 0;

  const btnBase = dark
    ? "text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition-all"
    : "text-xs text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 transition-all";

  return (
    <div
      className={dark ? "min-h-screen bg-slate-950 text-white flex flex-col" : "min-h-screen bg-gray-50 text-gray-900 flex flex-col"}
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className={dark ? "border-b border-slate-800 px-6 py-3.5 flex items-center justify-between shrink-0" : "border-b border-gray-200 bg-white px-6 py-3.5 flex items-center justify-between shrink-0"}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">M</div>
          <div>
            <span className={dark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-gray-900"}>Meeting Debrief</span>
            <span className={dark ? "text-slate-600 mx-2" : "text-gray-300 mx-2"}>·</span>
            <span className={dark ? "text-xs text-slate-500" : "text-xs text-gray-400"}>会议复盘 · 知识沉淀 · 后续行动生成器</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={btnBase} title="切换主题">
            {dark ? "☀️ 浅色" : "🌙 深色"}
          </button>
          {done && (
            <>
              <span className="text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">✓ 复盘完成</span>
              <button onClick={() => copyToClipboard(output, "all")} className={btnBase}>
                {copied === "all" ? "✓ 已复制" : "复制全文"}
              </button>
              <button onClick={exportMarkdown} className={btnBase}>导出 .md</button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={dark
          ? "w-64 shrink-0 border-r border-slate-800 flex flex-col p-4 gap-3 overflow-y-auto"
          : "w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col p-4 gap-3 overflow-y-auto"}>
          <div className="flex flex-col flex-1 gap-1.5">
            <label className={dark ? "text-xs text-slate-500 font-medium" : "text-xs text-gray-400 font-medium"}>会议内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"粘贴任意内容即可\n\n· 录音转写文本\n· 手写 / 口述笔记\n· 聊天记录文字\n· 邮件往来\n· 会议纪要草稿\n· 多种混合均可"}
              className={dark
                ? "flex-1 bg-slate-800/50 border border-slate-700/80 rounded-xl p-3.5 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/60 transition-colors leading-relaxed"
                : "flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 transition-colors leading-relaxed"}
              style={{ minHeight: "260px" }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className={dark
              ? "w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              : "w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"}
          >
            {loading ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />正在复盘...</>
            ) : "✦  开始会议复盘"}
          </button>

          {(content || output) && (
            <button
              onClick={() => { setContent(""); setOutput(""); setDone(false); setError(""); }}
              className={dark ? "w-full py-1.5 text-slate-600 hover:text-slate-400 text-xs transition-colors" : "w-full py-1.5 text-gray-400 hover:text-gray-600 text-xs transition-colors"}
            >
              清空重置
            </button>
          )}

          {error && (
            <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg p-3 leading-relaxed">{error}</div>
          )}

          {(loading || done) && <ProgressTracker completedKeys={completedKeys} theme={theme} />}
          {done && <SavePanel output={output} theme={theme} />}
        </div>

        {/* Right Panel */}
        <div ref={outputRef} className="flex-1 overflow-y-auto">
          {!showOutput && !loading && <DimensionMap theme={theme} />}

          {loading && !showOutput && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className={dark ? "w-7 h-7 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" : "w-7 h-7 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"} />
                <p className={dark ? "text-slate-400 text-sm" : "text-gray-400 text-sm"}>正在分析会议内容...</p>
              </div>
            </div>
          )}

          {showOutput && (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
              {sections.map((section, i) => {
                const meta = getSectionMeta(section.title);
                const displayTitle = stripPartPrefix(section.title);
                const isStreaming = loading && i === sections.length - 1;
                const accent = GROUP_ACCENT[meta.group] ?? "#64748b";

                return (
                  <div
                    key={i}
                    className={dark ? "rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden" : "rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"}
                    style={{ borderLeftWidth: "3px", borderLeftColor: meta.color }}
                  >
                    <div className={dark ? "flex items-center gap-2.5 px-5 py-3 border-b border-slate-800/60" : "flex items-center gap-2.5 px-5 py-3 border-b border-gray-100"}>
                      <span className="text-base">{meta.icon}</span>
                      <span className={dark ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-gray-800"}>{displayTitle}</span>
                      {meta.group && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}30` }}>
                          {meta.group}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {isStreaming && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />}
                        {!loading && section.content.trim() && (
                          <button
                            onClick={() => copyToClipboard(`## ${section.title}\n\n${section.content}`, `s-${i}`)}
                            className={dark
                              ? "text-xs text-slate-600 hover:text-slate-300 transition-colors px-2 py-0.5 rounded hover:bg-slate-700"
                              : "text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-0.5 rounded hover:bg-gray-100"}
                          >
                            {copied === `s-${i}` ? "✓" : "复制"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-4">{renderMarkdown(section.content, theme)}</div>
                  </div>
                );
              })}

              {loading && (
                <div className={dark ? "flex items-center gap-2 text-slate-600 text-xs px-1 pb-4" : "flex items-center gap-2 text-gray-400 text-xs px-1 pb-4"}>
                  <span className={dark ? "w-3 h-3 border border-slate-600 border-t-slate-400 rounded-full animate-spin" : "w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin"} />
                  继续生成中...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
