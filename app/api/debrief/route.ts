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

每个模块只提炼最有价值的内容，每条控制在一句话以内，不展开解释。请严格按照以下 3 大维度、8 个模块输出，每个 Part 使用 ## 标题：

---

## Part 1：一分钟复盘（Executive Summary）

不超过 6 条要点，每条一句话。覆盖：核心目标、实际成果、关键共识、明确的下一步、整体推进状态。读完即可快速还原整场会议。

---

## Part 2：关键事实与观点（Facts & Insights）

**关键事实**：不超过 5 条，每条一句话。只记录已明确确认的信息——对方介绍的情况、已确认的需求/方向/资源/时间节点/决定。不得混入推测。

**关键观点**：不超过 4 条，每条一句话。提炼真正值得记住的洞察——对方最关心的问题、优先级、隐含诉求、值得长期关注的信号。

---

## Part 3：达成共识（Agreements）

不超过 5 条，每条一句话。仅记录双方已明确一致的事项，不记录单方面表态或模糊承诺。

---

## Part 4：行动计划（Action Plan）

**已确认行动项**：只记录明确的行动项，表格不超过 8 行：

| 待办事项 | 负责方 | 优先级 | 建议截止日期 | 状态 |
|------|------|------|------|------|
| ... | 本方/对方/双方/待确认 | 高/中/低 | 建议日期 | 未开始 |

**建议后续动作**：不超过 4 条，按优先级排序，每条一句话，直接说做什么（如：发跟进邮件、安排下次会议、内部同步等）。

---

## Part 5：未解决问题（Open Questions）

不超过 5 条，每条一句话。只列真正悬而未决、需要跟进的问题。

---

## Part 6：关系经营洞察（Relationship Insights）

以主要发言人为核心，控制在 350 字以内。分条记录：沟通风格、决策偏好、关注重点、兴趣方向、对合作的真实态度、值得下次交流时记住的细节，以及可直接沉淀到联系人档案的增量信息。如有其他关键人物，每人 1-2 句话带过其角色与关键信息。

---

## Part 7：机会与风险（Opportunities & Risks）

**合作机会**：不超过 4 条，每条一句话，标注"已讨论"或"建议探索"。

**风险与阻碍**：不超过 4 条，每条一句话，标注高/中/低风险等级。

---

## Part 8：反思与下次备忘（Reflection & Next Meeting）

**反思**：不超过 4 条，每条一句话，聚焦最容易被遗漏的盲区与改进点。

**下次备忘**：不超过 4 条，每条一句话，直接可用的提醒。`;

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
