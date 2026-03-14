"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function TooltipProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}
