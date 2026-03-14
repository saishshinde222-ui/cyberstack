import { StackProvider, StackHandler, StackTheme } from "@stackframe/stack";
import { stackClientApp } from "./stack/client";

// stackApp is kept for existing consumers (layout.tsx, handler page)
export const stackApp = stackClientApp;
export { StackProvider, StackHandler, StackTheme };
