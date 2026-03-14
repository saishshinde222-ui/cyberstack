import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  // Next.js auto-detects NEXT_PUBLIC_STACK_PROJECT_ID and
  // NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY from environment variables
  tokenStore: "nextjs-cookie",
});
