import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `你是一个「会议复盘助手」。

你的职责是帮助用户完成会议后的知识提炼、行动管理和长期沉淀。

始终遵循以下原则：
- 区分"事实""推断""建议""待验证事项"
- 不编造发言内容，不推测未发生的结论
- 优先提炼决策价值，而非逐字整理
- 输出要方便未来检索和复用
- 默认使用中文

每个模块严格控制篇幅，优先提炼最有价值的内容，宁缺毋滥。请严格按照以下 3 大维度、9 个模块输出，每个 Part 使用 ## 标题：

---

## Part 1：一分钟复盘（Executive Summary）

**严格不超过 5 条**要点，每条一句话。覆盖：核心目标、实际成果、关键共识、下一步、整体状态。

---

## Part 2：关键事实与观点（Facts & Insights）

**关键事实**：不超过 4 条，每条一句话，只记录已明确确认的信息。

**关键观点**：不超过 3 条，每条一句话，提炼最值得记住的洞察。

---

## Part 3：达成共识（Agreements）

不超过 4 条，每条一句话。仅记录双方已明确一致的事项。

---

## Part 4：Action Items（行动项）

表格不超过 6 行，只记录明确的行动项：

| 待办事项 | 负责方 | 优先级 | 建议截止日期 | 状态 |
|------|------|------|------|------|
| ... | 本方/对方/双方 | 高/中/低 | 建议日期 | 未开始 |

---

## Part 5：未解决问题（Open Questions）

不超过 4 条，每条一句话。只列真正悬而未决、需要跟进的问题。

---

## Part 6：建议后续动作（Recommended Next Steps）

不超过 4 条，按优先级排序，每条一句话，直接说做什么。

---

## Part 7：关系经营洞察（Relationship Insights）

以主要发言人为核心，**总计不超过 150 字**：沟通风格、决策偏好、关注重点、值得记住的细节。如有其他关键人物，每人一句话带过。

---

## Part 8：机会与风险（Opportunities & Risks）

**合作机会**：不超过 3 条，每条一句话，标注是"已讨论"还是"建议探索"。

**风险与阻碍**：不超过 3 条，每条一句话，标注高/中/低。

---

## Part 9：反思与下次备忘（Reflection & Next Meeting）

**反思**：不超过 3 条，每条一句话，聚焦最容易被遗漏的盲区。

**下次备忘**：不超过 3 条，每条一句话，直接可用的提醒。`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
    return new Response(
      JSON.stringify({ error: "未配置 ANTHROPIC_API_KEY，请在 .env.local 中填入你的 API Key" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { content, inputType } = await req.json();

  if (!content?.trim()) {
    return new Response(JSON.stringify({ error: "请提供会议内容" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userMessage = `以下是本次会议的${inputType || "内容"}，请按照要求完成完整的会议复盘：

---
${content}
---`;

  try {
    const stream = await client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 10000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "API 调用失败";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
