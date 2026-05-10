import type { PreviewProps } from "./types";

export function UnsupportedPreview({ file }: PreviewProps) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-github-surface)] text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm opacity-50 mt-2">此文件类型不支持预览</p>
      <p className="text-xs opacity-30 mt-1">(.{ext})</p>
    </div>
  );
}