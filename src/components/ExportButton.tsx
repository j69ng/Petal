"use client";

export default function ExportButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-mute-light rounded-full px-4 py-2 text-sm hover:border-mute"
    >
      Export for your doctor (print / save as PDF)
    </button>
  );
}
