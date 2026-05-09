import type { FileInfo, SortConfig } from "@/types";

export function sortFiles(files: FileInfo[], sortConfig: SortConfig): FileInfo[] {
  return [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    switch (sortConfig.field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "size":
        cmp = a.size - b.size;
        break;
      case "modified":
        cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
      case "type":
        cmp = a.type - b.type;
        break;
    }
    return sortConfig.order === "asc" ? cmp : -cmp;
  });
}
