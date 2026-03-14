import type { Metadata } from "next";
import "./globals.css";
import { stackApp, StackProvider, StackTheme } from "@/stack.config";
import { TooltipProviderWrapper } from "./providers";

export const metadata: Metadata = {
  title: "Who Ran What | Security Audit Feed for GitHub Repos",
  description: "Security scans for GitHub repos — secrets, deps, code, config. Every scan attributed to real user + workspace via Stack Auth. Full audit trail.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <TooltipProviderWrapper>
          <StackProvider app={stackApp as Parameters<typeof StackProvider>[0]["app"]}>
            <StackTheme>
              {children}
            </StackTheme>
          </StackProvider>
        </TooltipProviderWrapper>
      </body>
    </html>
  );
}
