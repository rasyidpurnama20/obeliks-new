"use client";

export function WorkspaceSelectorCleaner() {
  return <style jsx global>{`
    .obe-workspace-popover .obe-separator,
    .obe-workspace-popover .obe-link-option {
      display: none !important;
    }
  `}</style>;
}
