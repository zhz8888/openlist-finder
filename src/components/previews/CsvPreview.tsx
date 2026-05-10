import { useState, useCallback, useMemo } from "react";
import type { PreviewProps } from "./types";

interface CsvRow {
  [key: string]: string;
}

export function CsvPreview({ file, serverUrl }: PreviewProps) {
  const [data, setData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const csvUrl = `${serverUrl}/d${file.path}`;

  const loadCsv = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.split("\n").filter(line => line.trim());

      if (lines.length === 0) {
        setData([]);
        setHeaders([]);
        return;
      }

      const headerLine = lines[0];
      const parsedHeaders = parseCSVLine(headerLine);
      setHeaders(parsedHeaders);

      const parsedData: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: CsvRow = {};
        parsedHeaders.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        parsedData.push(row);
      }

      setData(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [csvUrl]);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          current += "\"";
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="loading loading-spinner loading-sm"></span>
        <span className="ml-2 text-sm opacity-70">正在加载 CSV...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-[var(--color-danger)]">
        <p>{error}</p>
        <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={loadCsv}>
          重试
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-center text-sm opacity-50 py-8">CSV 文件为空</p>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)] overflow-auto max-h-96">
      <table className="table w-full text-xs">
        <thead className="bg-[var(--color-base)] sticky top-0">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-3 py-2 text-left cursor-pointer hover:bg-[var(--color-hover)]"
                onClick={() => handleSort(header)}
              >
                <div className="flex items-center gap-1">
                  <span>{header}</span>
                  {sortColumn === header && (
                    <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[var(--color-border)] hover:bg-[var(--color-hover)]">
              {headers.map((header, colIndex) => (
                <td key={colIndex} className="px-3 py-1.5 whitespace-nowrap">
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 text-xs opacity-50 border-t border-[var(--color-border)]">
        共 {data.length} 行, {headers.length} 列
      </div>
    </div>
  );
}