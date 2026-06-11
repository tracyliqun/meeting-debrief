import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Debrief Agent | 会议复盘",
  description: "会议复盘 · 知识沉淀 · 后续行动生成器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
