import type { ComponentType } from "react";
import type { FileInfo } from "@/types";

export interface PreviewMatcher {
  extensions?: readonly string[];
  objTypes?: readonly number[];
  provider?: string;
  predicate?: (file: FileInfo) => boolean;
}

export interface PreviewDefinition {
  id: string;
  name: string;
  priority?: number;
  supportsArchiveNavigation?: boolean;
  matcher: PreviewMatcher;
  component: () => Promise<{ default: ComponentType<unknown> }>;
}

export interface PreviewProps {
  file: FileInfo;
  serverUrl: string;
  archiveEntry?: string;
}

export interface RegistryEntry {
  definition: PreviewDefinition;
  component: ComponentType<PreviewProps> | null;
  priority: number;
}

export type PreviewComponent = ComponentType<PreviewProps>;