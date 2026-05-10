import type { PreviewProps } from "./types";

export function PdfPreview({ file, serverUrl }: PreviewProps) {
  const pdfUrl = `${serverUrl}/d${file.path}`;

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)]">
      <div className="p-4 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-sm opacity-50 mt-2">PDF 预览</p>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm mt-4"
        >
          在新窗口打开
        </a>
      </div>
    </div>
  );
}