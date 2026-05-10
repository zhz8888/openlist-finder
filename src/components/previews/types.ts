import type { ComponentType, LazyExoticComponent } from "react";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: LazyExoticComponent<ComponentType<any>>;
}

export interface PreviewProps {
  file: FileInfo;
  serverUrl: string;
  archiveEntry?: string;
}

export interface RegistryEntry {
  definition: PreviewDefinition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any> | null;
  priority: number;
}

export type PreviewComponent = ComponentType<PreviewProps>;