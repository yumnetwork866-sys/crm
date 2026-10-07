import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecordingState = 'idle' | 'recording' | 'recorded';

export interface VoiceRecordingResult {
  blob: Blob;
  dataUrl: string;
  duration: number;
}

export function useVoiceRecorder() {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<VoiceRecordingResult | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const stopResolverRef = useRef<((value: VoiceRecordingResult | null) => void) | null>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined'
      && Boolean(navigator?.mediaDevices?.getUserMedia)
      && typeof MediaRecorder !== 'undefined';
    setIsSupported(supported);
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      alert('Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp qua microphone.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      durationRef.current = 0;
      setRecordingDuration(0);
      setRecordedAudio(null);

      // Detect best supported MIME type
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/aac',
      ];
      let selectedMime = '';
      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMime = type;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        cleanupStream();

        const chunks = chunksRef.current;
        const duration = durationRef.current;
        const mime = selectedMime || 'audio/webm';

        if (chunks.length === 0) {
          if (stopResolverRef.current) {
            stopResolverRef.current(null);
            stopResolverRef.current = null;
          }
          setRecordingState('idle');
          return;
        }

        const blob = new Blob(chunks, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const result: VoiceRecordingResult = { blob, dataUrl, duration };
          setRecordedAudio(result);
          setRecordingState('recorded');
          if (stopResolverRef.current) {
            stopResolverRef.current(result);
            stopResolverRef.current = null;
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.onerror = () => {
        clearTimer();
        cleanupStream();
        setRecordingState('idle');
        if (stopResolverRef.current) {
          stopResolverRef.current(null);
          stopResolverRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Slice data every 250ms
      setRecordingState('recording');

      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setRecordingDuration(durationRef.current);
      }, 1000);

      return true;
    } catch (err: any) {
      console.error('[VoiceRecorder] Error starting recording:', err);
      cleanupStream();
      clearTimer();
      setRecordingState('idle');
      alert('Không thể truy cập microphone. Vui lòng cấp quyền truy cập micro trong trình duyệt để ghi âm giọng nói.');
      return false;
    }
  }, [cleanupStream, clearTimer, isSupported]);

  const stopRecording = useCallback((): Promise<VoiceRecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        clearTimer();
        cleanupStream();
        if (recordedAudio) {
          resolve(recordedAudio);
        } else {
          setRecordingState('idle');
          resolve(null);
        }
        return;
      }

      stopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        clearTimer();
        cleanupStream();
        setRecordingState('idle');
        resolve(null);
      }
    });
  }, [cleanupStream, clearTimer, recordedAudio]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {
        // ignore
      }
    }
    cleanupStream();
    chunksRef.current = [];
    durationRef.current = 0;
    setRecordingDuration(0);
    setRecordedAudio(null);
    setRecordingState('idle');
    if (stopResolverRef.current) {
      stopResolverRef.current(null);
      stopResolverRef.current = null;
    }
  }, [cleanupStream, clearTimer]);

  const resetRecording = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      cleanupStream();
    };
  }, [cleanupStream, clearTimer]);

  return {
    recordingState,
    isRecording: recordingState === 'recording',
    isRecorded: recordingState === 'recorded',
    recordingDuration,
    recordedAudio,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  };
}
