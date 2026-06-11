# Meeting Debrief

会议复盘助手——粘贴会议内容，自动生成 8 个维度的结构化复盘，支持保存到 Notion 或自定义 Webhook。

## 功能

- 3 大维度 · 8 个模块全链路分析：一分钟复盘、关键事实与观点、达成共识、行动计划、未解决问题、关系经营洞察、机会与风险、反思与下次备忘
- 流式输出，实时渲染
- 深色 / 浅色主题切换
- 支持保存到 Notion（用户自填凭证）或自定义 POST Webhook
- 可选访问密码保护

## 快速开始

**1. 克隆项目**

```bash
git clone https://github.com/tracyliqun/meeting-debrief.git
cd meeting-debrief
npm install
```

**2. 配置环境变量**

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你自己的 Key：

```env
# 必填：Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-...

# 可选：访问密码（不填则无需密码）
ACCESS_PASSWORD=your_password
```

**3. 启动**

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API Key，从 [console.anthropic.com](https://console.anthropic.com) 获取 |
| `ACCESS_PASSWORD` | 可选 | 访问密码，设置后访客需输入密码才能使用 |
| `NOTION_TOKEN` | 可选 | Notion Integration Token，也可在页面内由用户自填 |
| `NOTION_PARENT_PAGE_ID` | 可选 | Notion 父页面 ID，也可在页面内由用户自填 |

## 部署

任何支持 Node.js 的平台均可部署，推荐 Vercel：

```bash
npm i -g vercel
vercel --prod
```

部署后在平台设置 `ANTHROPIC_API_KEY` 和 `ACCESS_PASSWORD` 环境变量。

## Tech Stack

- [Next.js 16](https://nextjs.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Anthropic SDK](https://github.com/anthropic-ai/anthropic-sdk-python)
- [Notion SDK](https://github.com/makenotion/notion-sdk-js)
