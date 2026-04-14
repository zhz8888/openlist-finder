import { useFileBrowser } from "@/hooks";
import type { SortField } from "@/types";

export function Breadcrumb() {
  const { currentPath, navigateToPath } = useFileBrowser();

  const segments = currentPath.split("/").filter(Boolean);

  return (
    <div className="breadcrumbs text-sm px-4 py-2 bg-base-100 border-b border-base-300">
      <ul>
        <li>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => navigateToPath("/")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
            Root
          </button>
        </li>
        {segments.map((segment, index) => {
          const path = "/" + segments.slice(0, index + 1).join("/");
          return (
            <li key={path}>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => navigateToPath(path)}
              >
                {segment}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SortHeader({ field, label, currentSort, onSort }: { field: SortField; label: string; currentSort: { field: SortField; order: "asc" | "desc" }; onSort: (field: SortField) => void }) {
  const isActive = currentSort.field === field;
  return (
    <th
      className="cursor-pointer select-none hover:bg-base-200"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${currentSort.order === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </div>
    </th>
  );
}
