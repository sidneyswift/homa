import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Conforms a video to Twelve Labs' input floors (founder instruction
 * 2026-07-11: "for clips below 4 sec, just add the extra second").
 * Clips under 4 seconds get a freeze-frame tail (the last frame holds,
 * audio pads with silence) out to a comfortable 5 seconds; clips under
 * 360x360 upscale to the floor in the same pass, since we are
 * re-encoding anyway. Content is never invented: a padded clip shows
 * exactly what it showed, a beat longer.
 *
 * Runs ffmpeg + ffprobe as subprocesses: present on dev machines (and
 * any runtime that sets FFMPEG_PATH / FFPROBE_PATH), absent on Vercel
 * today, where every call returns null and callers keep their existing
 * fallbacks (the build-log entry owns that gap). Fail-soft by contract:
 * null on any failure (no binary, unreadable bytes, encode error),
 * never throws.
 */

/** Twelve Labs analyze floors (verified live 2026-07-11: HTTP 400 codes
 *  video_duration_too_short / video_resolution_too_low). */
const MIN_DURATION_SECONDS = 4;
const MIN_EDGE_PIXELS = 360;

/** Where short clips land: past the 4s floor with margin, so container
 *  duration rounding can never re-trip the rejection. */
const PAD_TARGET_SECONDS = 5;

/** A conform pass on a few-MB clip takes ~1s; anything past this is
 *  wedged, not working. */
const FFMPEG_TIMEOUT_MS = 45_000;

/** Padded output is always mp4, whatever container came in. */
export const CONFORMED_CONTENT_TYPE = "video/mp4";

/** Missing binaries are expected state in prod today; say so once per
 *  process instead of once per clip. */
let warnedMissingBinary = false;

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH ?? "ffmpeg";
}

function ffprobeBin(): string {
  return process.env.FFPROBE_PATH ?? "ffprobe";
}

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  missingBinary: boolean;
}

function runCommand(bin: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, stdout, stderr: "timed out", missingBinary: false });
    }, FFMPEG_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        stdout,
        stderr: error.message,
        missingBinary: error.code === "ENOENT",
      });
    });
    child.on("close", (code) => {
      finish({ ok: code === 0, stdout, stderr, missingBinary: false });
    });
  });
}

interface ProbedVideo {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** ffprobe's JSON output, the fields we read. */
interface FfprobePayload {
  format?: { duration?: string };
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
}

async function probeVideo(filePath: string): Promise<ProbedVideo | null> {
  const result = await runCommand(ffprobeBin(), [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  if (result.missingBinary) {
    if (!warnedMissingBinary) {
      warnedMissingBinary = true;
      console.error(
        "video pad unavailable: ffmpeg/ffprobe not on this runtime (set FFMPEG_PATH / FFPROBE_PATH to enable)",
      );
    }
    return null;
  }
  if (!result.ok) {
    console.error(`video pad probe failed: ${result.stderr.slice(0, 200)}`);
    return null;
  }

  try {
    const payload = JSON.parse(result.stdout) as FfprobePayload;
    const video = payload.streams?.find((s) => s.codec_type === "video");
    if (!video?.width || !video.height) return null;
    const duration = Number.parseFloat(
      payload.format?.duration ?? video.duration ?? "",
    );
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return {
      durationSeconds: duration,
      width: video.width,
      height: video.height,
      hasAudio: Boolean(
        payload.streams?.some((s) => s.codec_type === "audio"),
      ),
    };
  } catch {
    return null;
  }
}

/**
 * conformVideoToFloors(bytes): Promise<ArrayBuffer | null>
 * Re-encodes a clip so it clears the analyze floors: freeze-frame pad
 * to 5s when under 4s, upscale to 360x360 (aspect preserved) when
 * under it. Returns mp4 bytes, or null when there is nothing to fix or
 * anything fails (including no ffmpeg on this runtime). Never throws.
 * Callers treat null as "keep your existing fallback".
 */
export async function conformVideoToFloors(
  bytes: ArrayBuffer,
): Promise<ArrayBuffer | null> {
  if (bytes.byteLength === 0) return null;

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "homa-video-pad-"));
    const inputPath = join(workDir, "in.bin");
    const outputPath = join(workDir, "out.mp4");
    await writeFile(inputPath, Buffer.from(bytes));

    const probed = await probeVideo(inputPath);
    if (!probed) return null;

    const tooShort = probed.durationSeconds < MIN_DURATION_SECONDS;
    const tooSmall =
      probed.width < MIN_EDGE_PIXELS || probed.height < MIN_EDGE_PIXELS;
    if (!tooShort && !tooSmall) return null;

    const videoFilters: string[] = [];
    if (tooShort) {
      // Overshoot the freeze tail slightly; -t below trims to the
      // target, so rounding can never leave the clip a hair short.
      const stopDuration =
        PAD_TARGET_SECONDS - probed.durationSeconds + 0.5;
      videoFilters.push(
        `tpad=stop_mode=clone:stop_duration=${stopDuration.toFixed(2)}`,
      );
    }
    if (tooSmall) {
      videoFilters.push(
        `scale=${MIN_EDGE_PIXELS}:${MIN_EDGE_PIXELS}:force_original_aspect_ratio=increase:force_divisible_by=2`,
      );
    }

    const args = ["-y", "-i", inputPath, "-vf", videoFilters.join(",")];
    if (probed.hasAudio) {
      if (tooShort) args.push("-af", "apad");
      args.push("-c:a", "aac");
    } else {
      args.push("-an");
    }
    if (tooShort) args.push("-t", String(PAD_TARGET_SECONDS));
    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    );

    const encoded = await runCommand(ffmpegBin(), args);
    if (!encoded.ok) {
      if (!encoded.missingBinary) {
        console.error(`video pad encode failed: ${encoded.stderr.slice(-300)}`);
      }
      return null;
    }

    const output = await readFile(outputPath);
    if (output.byteLength === 0) return null;
    console.log(
      `video pad: ${probed.durationSeconds.toFixed(1)}s ${probed.width}x${probed.height} conformed for analysis` +
        `${tooShort ? `, padded to ${PAD_TARGET_SECONDS}s` : ""}${tooSmall ? `, upscaled to ${MIN_EDGE_PIXELS}p floor` : ""}`,
    );
    return output.buffer.slice(
      output.byteOffset,
      output.byteOffset + output.byteLength,
    );
  } catch (error) {
    console.error(
      "video pad failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
