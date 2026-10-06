import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Mic, Pause, Play } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string;
  caption?: string | null;
  timeFormatted: string;
  isAgent?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  caption,
  timeFormatted,
  isAgent = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      setIsError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // For webm recordings with initial Infinity duration, update when known
      if (isFinite(audio.duration) && audio.duration > 0 && duration === 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [duration, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Failed to play audio:', err);
        setIsPlaying(false);
      });
    }
  };

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audio) {
      audio.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const effectiveDuration = duration || (isFinite(audio.duration) ? audio.duration : 0);
    if (!effectiveDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * effectiveDuration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const effectiveDuration = duration || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
  const progressPercent = effectiveDuration > 0
    ? Math.min(100, (currentTime / effectiveDuration) * 100)
    : 0;

  return (
    <div className="w-full min-w-[240px] max-w-[320px] select-none py-1">
      <div className="flex items-center gap-2.5">
        {/* Play / Pause Circular Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-xs active:scale-95 cursor-pointer shrink-0"
          title={isPlaying ? 'Tạm dừng' : 'Phát ghi âm'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Scrubber / Waveform track */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
          <div
            onClick={handleSeek}
            className="relative w-full h-4 flex items-center cursor-pointer group"
          >
            <div className="w-full h-1 bg-slate-300/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1fa855] rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div
              className="absolute w-3 h-3 bg-[#1fa855] rounded-full shadow-sm -ml-1.5 opacity-90 group-hover:scale-125 transition"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>
              {isPlaying || currentTime > 0
                ? formatDuration(currentTime)
                : formatDuration(effectiveDuration)}
            </span>
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="px-1.5 py-0.2 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-sans font-bold text-[10px] transition cursor-pointer"
              title="Tốc độ phát âm thanh"
            >
              {playbackRate}x
            </button>
          </div>
        </div>

        {/* Mic Badge */}
        <div className="w-7 h-7 rounded-full bg-slate-100 text-[#1fa855] flex items-center justify-center shrink-0">
          <Mic className="w-3.5 h-3.5" />
        </div>
      </div>

      {isError && (
        <p className="text-[11px] text-amber-600 mt-1 italic">
          Không thể phát tệp âm thanh này.
        </p>
      )}

      {caption && (
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pt-1">
          {caption}
        </div>
      )}

      <div className="flex justify-end items-center gap-0.5 text-[11px] text-[#667781] mt-1 select-none">
        <span>{timeFormatted}</span>
        {isAgent && (
          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0 inline-block" />
        )}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
};
