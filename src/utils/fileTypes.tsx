import { memo } from "react";
import type { FileInfo } from "@/types";

const TEXT_EXTS = ["txt", "text", "json", "xml", "yaml", "yml", "markdown", "md", "csv", "log", "ini", "conf", "cfg", "sh", "bat", "ps1", "py", "js", "ts", "jsx", "tsx", "css", "html", "sql", "env", "gitignore", "toml", "rs", "go", "java", "c", "cpp", "h", "hpp", "vue", "svelte"] as const;

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "avif"] as const;

const VIDEO_EXTS = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"] as const;

const AUDIO_EXTS = ["mp3", "wav", "flac", "aac", "ogg", "wma"] as const;

const ARCHIVE_EXTS = ["zip", "rar", "7z", "tar", "gz", "bz2"] as const;

const DOCUMENT_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const;

const CODE_EXTS = ["js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp", "go", "rs", "vue", "svelte", "css", "html", "json", "xml", "yaml", "yml", "md", "sh", "sql"] as const;

const EXECUTABLE_EXTS = ["exe", "msi", "dmg", "app", "deb", "rpm"] as const;

export type FileType = "text" | "image" | "video" | "audio" | "archive" | "document" | "code" | "executable" | "unknown";

export function getFileExtension(file: FileInfo): string {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

export function isTextFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return TEXT_EXTS.includes(getFileExtension(file) as typeof TEXT_EXTS[number]);
}

export function isImageFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return IMAGE_EXTS.includes(getFileExtension(file) as typeof IMAGE_EXTS[number]);
}

export function isVideoFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return VIDEO_EXTS.includes(getFileExtension(file) as typeof VIDEO_EXTS[number]);
}

export function isAudioFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return AUDIO_EXTS.includes(getFileExtension(file) as typeof AUDIO_EXTS[number]);
}

export function isArchiveFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return ARCHIVE_EXTS.includes(getFileExtension(file) as typeof ARCHIVE_EXTS[number]);
}

export function isDocumentFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return DOCUMENT_EXTS.includes(getFileExtension(file) as typeof DOCUMENT_EXTS[number]);
}

export function isCodeFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return CODE_EXTS.includes(getFileExtension(file) as typeof CODE_EXTS[number]);
}

export function isExecutableFile(file: FileInfo): boolean {
  if (file.isDir) return false;
  return EXECUTABLE_EXTS.includes(getFileExtension(file) as typeof EXECUTABLE_EXTS[number]);
}

export function getFileType(file: FileInfo): FileType {
  if (file.isDir) return "unknown";
  const ext = getFileExtension(file);
  if (!ext) return "unknown";
  if (isTextFile(file)) return "text";
  if (isImageFile(file)) return "image";
  if (isVideoFile(file)) return "video";
  if (isAudioFile(file)) return "audio";
  if (isArchiveFile(file)) return "archive";
  if (isDocumentFile(file)) return "document";
  if (isCodeFile(file)) return "code";
  if (isExecutableFile(file)) return "executable";
  return "unknown";
}

export function getFileTypeDescription(file: FileInfo): string {
  if (file.isDir) return "文件夹";

  const ext = getFileExtension(file);
  if (!ext) return "文件";

  if (IMAGE_EXTS.includes(ext as typeof IMAGE_EXTS[number])) {
    return `图片文件 (.${ext})`;
  }

  if (VIDEO_EXTS.includes(ext as typeof VIDEO_EXTS[number])) {
    return `视频文件 (.${ext})`;
  }

  if (AUDIO_EXTS.includes(ext as typeof AUDIO_EXTS[number])) {
    return `音频文件 (.${ext})`;
  }

  if (DOCUMENT_EXTS.includes(ext as typeof DOCUMENT_EXTS[number])) {
    return `文档文件 (.${ext})`;
  }

  if (ARCHIVE_EXTS.includes(ext as typeof ARCHIVE_EXTS[number])) {
    return `压缩文件 (.${ext})`;
  }

  if (CODE_EXTS.includes(ext as typeof CODE_EXTS[number])) {
    return `代码文件 (.${ext})`;
  }

  if (EXECUTABLE_EXTS.includes(ext as typeof EXECUTABLE_EXTS[number])) {
    return `可执行文件 (.${ext})`;
  }

  return `文件 (.${ext})`;
}

export { TEXT_EXTS, IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS, ARCHIVE_EXTS, DOCUMENT_EXTS, CODE_EXTS, EXECUTABLE_EXTS };

interface FileIconProps {
  file: FileInfo;
}

const FolderIcon = memo(function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
});

const ImageIcon = memo(function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
});

const VideoIcon = memo(function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
});

const AudioIcon = memo(function AudioIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
});

const DocumentIcon = memo(function DocumentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
});

const ArchiveIcon = memo(function ArchiveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
});

const CodeIcon = memo(function CodeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-info)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
});

const ExecutableIcon = memo(function ExecutableIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-neutral)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
});

const DefaultFileIcon = memo(function DefaultFileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
});

export const FileIcon = memo(function FileIcon({ file }: FileIconProps) {
  if (file.isDir) {
    return <FolderIcon />;
  }

  const ext = getFileExtension(file);

  if (IMAGE_EXTS.includes(ext as typeof IMAGE_EXTS[number])) {
    return <ImageIcon />;
  }

  if (VIDEO_EXTS.includes(ext as typeof VIDEO_EXTS[number])) {
    return <VideoIcon />;
  }

  if (AUDIO_EXTS.includes(ext as typeof AUDIO_EXTS[number])) {
    return <AudioIcon />;
  }

  if (DOCUMENT_EXTS.includes(ext as typeof DOCUMENT_EXTS[number])) {
    return <DocumentIcon />;
  }

  if (ARCHIVE_EXTS.includes(ext as typeof ARCHIVE_EXTS[number])) {
    return <ArchiveIcon />;
  }

  if (CODE_EXTS.includes(ext as typeof CODE_EXTS[number])) {
    return <CodeIcon />;
  }

  if (EXECUTABLE_EXTS.includes(ext as typeof EXECUTABLE_EXTS[number])) {
    return <ExecutableIcon />;
  }

  return <DefaultFileIcon />;
});

export function getFileIcon(file: FileInfo) {
  return <FileIcon file={file} />;
}
