"use client";

export function UserFilterUnifier() {
  return <style jsx global>{`
    html[data-obe-user-access-refined="true"] [class*="toolbar"] > label:has(select[aria-label="Filter status akun"]),
    html[data-obe-user-access-refined="true"] .obe-role-filter {
      display: inline-flex !important;
      align-items: center !important;
      gap: 7px !important;
      margin-left: 0 !important;
      color: #667785;
      font-size: 9px;
      font-weight: 750;
      white-space: nowrap;
    }
    html[data-obe-user-access-refined="true"] [class*="toolbar"] > label:has(select[aria-label="Filter status akun"]) {
      margin-left: auto !important;
    }
    html[data-obe-user-access-refined="true"] [class*="toolbar"] > label:has(select[aria-label="Filter status akun"])::before {
      content: "Status";
    }
    html[data-obe-user-access-refined="true"] [class*="toolbar"] select[aria-label="Filter status akun"],
    html[data-obe-user-access-refined="true"] .obe-role-filter select {
      width: 160px !important;
      min-width: 160px !important;
      height: 34px !important;
      border: 1px solid #d7e0e5 !important;
      border-radius: 9px !important;
      background: #fff !important;
      padding: 0 30px 0 10px !important;
      color: #31414e !important;
      font: inherit !important;
      font-size: 10px !important;
    }
    @media (max-width: 720px) {
      html[data-obe-user-access-refined="true"] [class*="toolbar"] > label:has(select[aria-label="Filter status akun"]),
      html[data-obe-user-access-refined="true"] .obe-role-filter {
        width: 100% !important;
        margin-left: 0 !important;
        justify-content: space-between !important;
      }
      html[data-obe-user-access-refined="true"] [class*="toolbar"] select[aria-label="Filter status akun"],
      html[data-obe-user-access-refined="true"] .obe-role-filter select {
        flex: 1;
        width: auto !important;
      }
    }
  `}</style>;
}
