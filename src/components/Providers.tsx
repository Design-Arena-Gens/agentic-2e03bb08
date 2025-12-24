"use client";

import type { PropsWithChildren } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        closeButton
        toastOptions={{
          duration: 3500,
          className: "border border-white/10 bg-slate-900/80 backdrop-blur"
        }}
      />
    </>
  );
}
