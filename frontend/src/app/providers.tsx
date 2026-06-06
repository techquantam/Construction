"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AppContextProvider } from '../context/AppContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Prevent Tab key default navigation
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }

      // 2. Custom Enter key navigation
      if (e.key === "Enter") {
        // If event default was already prevented by a local handler, skip
        if (e.defaultPrevented) return;

        const active = document.activeElement as HTMLElement;
        if (!active) return;

        const tagName = active.tagName.toLowerCase();
        const isInput = tagName === "input";
        const isSelect = tagName === "select";
        const isTextarea = tagName === "textarea";

        // Allow default Enter behavior inside Textarea
        if (isTextarea) return;

        const inputType = isInput ? (active as HTMLInputElement).type.toLowerCase() : "";
        
        // Let buttons, submit inputs, and anchors trigger their default click actions on Enter
        if (
          tagName === "button" ||
          inputType === "submit" ||
          inputType === "button" ||
          tagName === "a"
        ) {
          return;
        }

        // Find all visible, focusable elements
        const focusableSelector =
          'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
        
        const allFocusable = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
          .filter((el) => {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") return false;
            
            // Check visibility based on dimensions
            return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          });

        const currentIndex = allFocusable.indexOf(active);
        if (currentIndex !== -1) {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % allFocusable.length;
          const nextEl = allFocusable[nextIndex];
          nextEl.focus();

          // Auto-select text in target input fields for easier typing
          if (nextEl.tagName.toLowerCase() === "input") {
            (nextEl as HTMLInputElement).select?.();
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppContextProvider>
        {children}
      </AppContextProvider>
    </QueryClientProvider>
  );
}
