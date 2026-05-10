import { useState, useCallback, useRef, useEffect } from "react";
import type { PreviewProps } from "./types";

export function ImagePreview({ file, serverUrl }: PreviewProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const imageUrl = `${serverUrl}/d${file.path}`;

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)] ${
        isFullscreen ? "fixed inset-0 z-50 bg-black flex items-center justify-center" : ""
      }`}
    >
      <div className={`absolute top-2 right-2 flex gap-1 z-10 ${isFullscreen ? "bg-black/50 rounded-lg p-1" : ""}`}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleZoomIn}
          title="放大"
          disabled={scale >= 5}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleZoomOut}
          title="缩小"
          disabled={scale <= 0.25}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleRotate}
          title="旋转"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleReset}
          title="重置"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleFullscreen}
          title={isFullscreen ? "退出全屏" : "全屏"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isFullscreen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 16v4m0 0h4m8-4h4m0 0v4m0-4V4m0 0h-4M8 4H4m0 0v4m4 8h4m0 0v4m0-4H4m4-8H4m0 0v4" />
            )}
          </svg>
        </button>
      </div>

      <div className={`flex items-center justify-center overflow-auto ${isFullscreen ? "w-full h-full" : "p-2 max-h-96"}`}>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
            <span className="ml-2 text-sm opacity-70">正在加载图片...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm opacity-50 mt-2">图片加载失败</p>
          </div>
        )}

        {!isLoading && !error && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={file.name}
            className="max-w-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              maxHeight: isFullscreen ? "90vh" : "384px",
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>

      {!isLoading && !error && (
        <div className="absolute bottom-2 left-2 text-xs opacity-50 bg-black/50 px-2 py-1 rounded">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}