import { Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  RichTextItemRequest,
} from "@notionhq/client/build/src/api-endpoints";

// ─── Markdown → Notion blocks ─────────────────────────────────────────────────
function richText(text: string): RichTextItemRequest[] {
  const parts: RichTextItemRequest[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", text: { content: text.slice(last, m.index) } });
    }
    parts.push({ type: "text", text: { content: m[1] }, annotations: { bold: true } });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", text: { content: text.slice(last) } });
  }
  return parts.length > 0 ? parts : [{ type: "text", text: { content: text } }];
}

function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[-| ]+\|/)) {
      const headers = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }

      const tableWidth = Math.max(headers.length, ...rows.map((r) => r.length));
      blocks.push({
        type: "table",
        table: {
          table_width: tableWidth,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: "table_row",
              table_row: {
                cells: headers.map((h) => [{ type: "text", text: { content: h }, annotations: { bold: true } }] as RichTextItemRequest[]),
              },
            },
            ...rows.map((row) => ({
              type: "table_row" as const,
              table_row: {
                cells: Array.from({ length: tableWidth }, (_, j) => richText(row[j] ?? "")),
              },
            })),
          ],
        },
      } as BlockObjectRequest);
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading_2", heading_2: { rich_text: richText(line.replace("## ", "")) } });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "heading_3", heading_3: { rich_text: richText(line.replace("### ", "")) } });
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      blocks.push({ type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(line.replace(/^[-•]\s/, "")) } });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ type: "numbered_list_item", numbered_list_item: { rich_text: richText(line.replace(/^\d+\.\s/, "")) } });
    } else if (line.trim() === "---") {
      blocks.push({ type: "divider", divider: {} });
    } else if (line.trim() !== "") {
      blocks.push({ type: "paragraph", paragraph: { rich_text: richText(line) } });
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.type !== "paragraph") {
        blocks.push({ type: "paragraph", paragraph: { rich_text: [] } });
      }
    }

    i++;
  }

  return blocks;
}

async function appendBlocks(notion: Client, pageId: string, blocks: BlockObjectRequest[]) {
  const CHUNK = 100;
  for (let i = 0; i < blocks.length; i += CHUNK) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + CHUNK),
    });
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
  const { markdown, title, notionToken, parentPageId } = body;

  // Accept credentials from request body, fall back to env vars
  const token = notionToken?.trim() || process.env.NOTION_TOKEN;
  const pageId = parentPageId?.trim() || process.env.NOTION_PARENT_PAGE_ID;

  if (!token) {
    return Response.json({ error: "请提供 Notion Integration Token" }, { status: 400 });
  }
  if (!pageId) {
    return Response.json({ error: "请提供 Notion 父页面 ID" }, { status: 400 });
  }
  if (!markdown?.trim()) {
    return Response.json({ error: "复盘内容为空" }, { status: 400 });
  }

  const notion = new Client({ auth: token });

  try {
    const page = await notion.pages.create({
      parent: { type: "page_id", page_id: pageId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: title || "会议复盘" } }],
        },
      },
    });

    const blocks = markdownToBlocks(markdown);
    await appendBlocks(notion, page.id, blocks);

    const pageUrl = `https://notion.so/${page.id.replace(/-/g, "")}`;
    return Response.json({ success: true, url: pageUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Notion API 调用失败";
    return Response.json({ error: msg }, { status: 500 });
  }
}
