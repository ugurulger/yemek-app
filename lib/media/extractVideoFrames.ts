import * as VideoThumbnails from 'expo-video-thumbnails';
import { File } from 'expo-file-system';

export interface ExtractVideoFramesOptions {
  /** Maximum number of frames to extract. Defaults to 8. */
  maxFrames?: number;
  /** Interval between frames in milliseconds. Defaults to 1000 (1 frame per second). */
  intervalMs?: number;
}

const DEFAULT_MAX_FRAMES = 8;
const DEFAULT_INTERVAL_MS = 1000;

/**
 * Extracts frames from a local video file at a fixed time interval and returns
 * each frame as a raw base64-encoded JPEG string (no `data:` URI prefix).
 *
 * The video's duration is not known ahead of time, so frames are requested
 * starting at t=0 and stepping forward by `intervalMs` until either
 * `maxFrames` frames have been collected, or `expo-video-thumbnails` throws
 * (which normally indicates the requested time is past the end of the video).
 * That error is treated as a normal stop condition, not a failure.
 */
export async function extractVideoFramesAsBase64(
  videoUri: string,
  options?: ExtractVideoFramesOptions
): Promise<string[]> {
  const maxFrames = options?.maxFrames ?? DEFAULT_MAX_FRAMES;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const framesBase64: string[] = [];
  const thumbnailUrisToCleanUp: string[] = [];

  for (let frameIndex = 0; frameIndex < maxFrames; frameIndex++) {
    const time = frameIndex * intervalMs;

    let thumbnail: VideoThumbnails.VideoThumbnailsResult;
    try {
      thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, { time });
    } catch {
      // Most commonly this means `time` is past the end of the video.
      // Treat it as the natural end of extraction rather than an error.
      break;
    }

    thumbnailUrisToCleanUp.push(thumbnail.uri);

    try {
      const file = new File(thumbnail.uri);
      const base64 = await file.base64();
      framesBase64.push(base64);
    } catch {
      // Couldn't read/convert this particular frame; skip it and keep going.
    }
  }

  // Clean up temporary thumbnail files. Failures here are non-critical.
  for (const uri of thumbnailUrisToCleanUp) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Ignore cleanup errors.
    }
  }

  return framesBase64;
}
