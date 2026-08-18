import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CameraPermissionState } from '../types';

interface UseCameraResult {
  permission: CameraPermissionState;
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Integration Plan §5.1 constraint 예시(facingMode: 'user') 기준.
// 해상도/FPS는 기기별 강제 실패를 피하기 위해 ideal로만 요청한다.
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permission, setPermission] = useState<CameraPermissionState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStream(null);
    setPermission('idle');
  }, []);

  const start = useCallback(async () => {
    setPermission('requesting');
    setErrorMessage(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: false,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setPermission('granted');
    } catch (error) {
      streamRef.current = null;
      setStream(null);

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setPermission('denied');
      } else {
        setPermission('error');
      }

      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { permission, stream, videoRef, errorMessage, start, stop };
}
