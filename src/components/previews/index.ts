import { lazy, Suspense } from "react";
import type { PreviewDefinition, RegistryEntry, PreviewMatcher } from "./types";
import type { FileInfo } from "@/types";

const PREVIEW_DEFINITIONS: PreviewDefinition[] = [
  {
    id: "image",
    name: "图片",
    priority: 100,
    matcher: { extensions: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "avif"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./ImagePreview").then(m => ({ default: m.ImagePreview }))) as any,
  },
  {
    id: "video",
    name: "视频",
    priority: 90,
    matcher: { extensions: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./VideoPreview").then(m => ({ default: m.VideoPreview }))) as any,
  },
  {
    id: "audio",
    name: "音频",
    priority: 80,
    matcher: { extensions: ["mp3", "wav", "flac", "aac", "ogg", "wma"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./AudioPreview").then(m => ({ default: m.AudioPreview }))) as any,
  },
  {
    id: "archive",
    name: "压缩包",
    priority: 70,
    matcher: { extensions: ["zip", "rar", "7z", "tar", "gz", "bz2"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./ArchivePreview").then(m => ({ default: m.ArchivePreview }))) as any,
    supportsArchiveNavigation: true,
  },
  {
    id: "pdf",
    name: "PDF",
    priority: 60,
    matcher: { extensions: ["pdf"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./PdfPreview").then(m => ({ default: m.PdfPreview }))) as any,
  },
  {
    id: "csv",
    name: "CSV",
    priority: 55,
    matcher: { extensions: ["csv"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./CsvPreview").then(m => ({ default: m.CsvPreview }))) as any,
  },
  {
    id: "text",
    name: "文本",
    priority: 50,
    matcher: { extensions: ["txt", "text", "json", "xml", "yaml", "yml", "md", "log", "ini", "conf", "cfg", "sh", "bat", "ps1", "py", "js", "ts", "jsx", "tsx", "css", "html", "sql", "env", "gitignore", "toml", "rs", "go", "java", "c", "cpp", "h", "hpp", "vue", "svelte"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: lazy(() => import("./TextPreview").then(m => ({ default: m.TextPreview }))) as any,
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UnsupportedPreview = lazy(() => import("./UnsupportedPreview").then(m => ({ default: m.UnsupportedPreview }))) as any;

class PreviewRegistry {
  private registry: RegistryEntry[] = [];
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    this.registry = PREVIEW_DEFINITIONS
      .map(def => ({
        definition: def,
        component: null,
        priority: def.priority ?? 0,
      }))
      .sort((a, b) => b.priority - a.priority);

    this.initialized = true;
  }

  register(definition: PreviewDefinition) {
    this.initialize();

    const entry: RegistryEntry = {
      definition,
      component: null,
      priority: definition.priority ?? 0,
    };

    const insertIndex = this.registry.findIndex(e => e.priority < entry.priority);
    if (insertIndex === -1) {
      this.registry.push(entry);
    } else {
      this.registry.splice(insertIndex, 0, entry);
    }
  }

  match(file: FileInfo): RegistryEntry | null {
    this.initialize();

    for (const entry of this.registry) {
      if (this.matches(entry.definition.matcher, file)) {
        return entry;
      }
    }

    return null;
  }

  matchAll(file: FileInfo): RegistryEntry[] {
    this.initialize();

    return this.registry.filter(entry =>
      this.matches(entry.definition.matcher, file)
    );
  }

  private matches(matcher: PreviewMatcher, file: FileInfo): boolean {
    if (matcher.extensions?.length) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!matcher.extensions.includes(ext)) {
        return false;
      }
    }

    if (matcher.objTypes?.length) {
      if (!matcher.objTypes.includes(file.type)) {
        return false;
      }
    }

    if (matcher.predicate && !matcher.predicate(file)) {
      return false;
    }

    return true;
  }

  get count(): number {
    this.initialize();
    return this.registry.length;
  }
}

export const previewRegistry = new PreviewRegistry();

export function usePreview(file: FileInfo) {
  const entry = previewRegistry.match(file);

  if (!entry) {
    return {
      previewId: null,
      component: null,
      supportsArchiveNavigation: false,
      isSupported: false,
    };
  }

  return {
    previewId: entry.definition.id,
    component: entry.component,
    supportsArchiveNavigation: entry.definition.supportsArchiveNavigation ?? false,
    isSupported: true,
  };
}

export { PREVIEW_DEFINITIONS };