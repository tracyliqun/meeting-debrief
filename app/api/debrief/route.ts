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

请严格按照以下 3 大维度、9 个模块输出，每个 Part 使用 ## 标题：

---

## Part 1：一分钟复盘（Executive Summary）

用不超过 8 条要点回答：本次会议的核心目标、取得的成果、是否达成关键共识、明确的下一步、当前整体推进状态。读完这一部分即可快速还原整场会议。

---

## Part 2：关键事实与观点（Facts & Insights）

**关键事实**：客观记录已经明确确认的信息——对方介绍的情况、已确认的需求/方向/资源/时间节点/决定。不得混入推测。

**关键观点**：提炼真正值得记住的洞察——对方最关心的问题、优先级排序、隐含诉求、重复强调的内容、值得长期关注的信号。进行总结而非简单摘录。

---

## Part 3：达成共识（Agreements）

列出双方已明确达成一致的事项。仅记录已确认内容，不记录单方面表态或模糊承诺。

---

## Part 4：Action Items（行动项）

使用以下格式输出行动项表格：

| 待办事项 | 负责方 | 优先级 | 建议截止日期 | 状态 |
|------|------|------|------|------|
| ... | 本方/对方/双方/待确认 | 高/中/低 | 建议日期 | 未开始 |

---

## Part 5：未解决问题（Open Questions）

整理会议结束时仍未明确的问题，包括：尚待确认事项、内部讨论未完、第三方决策待跟进、存在分歧的问题。

---

## Part 6：建议后续动作（Recommended Next Steps）

结合会议结果，建议：是否需要发送跟进邮件或资料、是否需要安排下次会议、是否需要内部同步。按优先级排序。

---

## Part 7：关系经营洞察（Relationship Insights）

以主要发言人为核心（占主要篇幅），重点提炼：沟通风格、决策偏好、关注重点、兴趣方向、对合作的真实态度，以及下次交流时值得记住的细节。如会议中提及其他关键人物（决策者、推荐人、潜在合作方等），一并简要记录其角色与相关信息。输出可直接沉淀为联系人档案增量。

---

## Part 8：机会与风险（Opportunities & Risks）

**合作机会**：新发现的合作方向、可进一步探索的话题、潜在联合项目。明确区分"已讨论机会"和"推导出的建议机会"。

**风险与阻碍**：识别可能影响推进的问题，按高/中/低标记风险等级。

---

## Part 9：反思与下次备忘（Reflection & Next Meeting）

**反思**：有没有重要问题没有讨论？有没有承诺未形成 Action Item？有没有风险被低估？有没有容易遗忘但未来重要的信息？

**下次会面备忘**：不超过 5 条的下次会面提醒——上次承诺是否完成、对方感兴趣的话题、应避免的重复内容、可切入的话题、建议邀请的人员等。`;

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
      max_tokens: 6000,
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
