import { useState, useRef, useCallback, useEffect } from "react";
import type { PreviewProps } from "./types";

function getFileTypeDescription(file: { name: string }): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return `音频文件 (.${ext})`;
}

export function AudioPreview({ file, serverUrl }: PreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const audioUrl = `${serverUrl}/d${file.path}`;

  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const vol = parseFloat(e.target.value);
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsLoading(false);
      setError(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, currentTime - 5);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(duration, currentTime + 5);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (audioRef.current) {
          const newVolume = Math.min(1, volume + 0.1);
          audioRef.current.volume = newVolume;
          setVolume(newVolume);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (audioRef.current) {
          const newVolume = Math.max(0, volume - 0.1);
          audioRef.current.volume = newVolume;
          setVolume(newVolume);
        }
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlay, toggleMute, currentTime, duration, volume]);

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-github-surface)] p-6">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--color-accent)]/10 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h4 className="font-medium text-lg">{file.name}</h4>
        <p className="text-sm opacity-50 mt-1">{getFileTypeDescription(file)}</p>
      </div>

      {isLoading && !error && (
        <div className="flex items-center justify-center py-4 mb-4">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="ml-2 text-sm opacity-70">正在加载音频...</span>
        </div>
      )}

      {error && (
        <div className="text-center py-4 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-sm opacity-50 mt-2">音频加载失败</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-[var(--color-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]"
            />
            <div className="flex justify-between text-xs opacity-50 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, currentTime - 5);
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.934a.5.5 0 00-.732.432v3.268a.5.5 0 00.732.432l4.5-2.634a.5.5 0 000-.864l-4.5-2.634z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
              </svg>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(duration, currentTime + 5);
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.934 12.066a.5.5 0 00.432.732h3.268a.5.5 0 00.432-.732l-2.634-4.5a.5.5 0 00-.864 0l-2.634 4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2M9 9l6 6m-6-6l6-6" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m0 0a3 3 0 004.243 0M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-32 h-2 bg-[var(--color-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]"
            />

            <span className="text-xs opacity-50 w-10">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}