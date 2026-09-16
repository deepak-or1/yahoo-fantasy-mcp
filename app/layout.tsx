import type { ReactNode } from "react";

export const metadata = { title: "Yahoo Fantasy MCP", description: "Let ChatGPT or Claude read your Yahoo Fantasy league." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, system-ui, sans-serif", margin: 0, background: "#f6f3ee", color: "#1d1a16" }}>{children}</body>
    </html>
  );
}
