// apps/web/src/lib/microphone.ts
// One place to ask for the microphone. Browsers (and the phone app's web view) only offer navigator.mediaDevices on
// a secure page: https, or localhost. Opened over plain http, such as http://192.168.x.x during development, it is
// undefined, and calling navigator.mediaDevices.getUserMedia crashes with "Cannot read properties of undefined
// (reading 'getUserMedia')". These helpers check first and explain what is wrong instead.
import { tr } from "../i18n/core";

export type MicrophoneSupport = "ok" | "insecure" | "unsupported";

/** Whether this page can ask for the microphone at all (before any permission prompt) */
export function microphoneSupport(): MicrophoneSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (typeof navigator.mediaDevices?.getUserMedia === "function") return "ok";
  return window.isSecureContext === false ? "insecure" : "unsupported";
}

export const canUseMicrophone = () => microphoneSupport() === "ok";

/** What to tell someone whose page can't use the microphone */
export function microphoneUnavailableMessage(support: MicrophoneSupport = microphoneSupport()): string {
  return support === "insecure"
    ? tr("The microphone only works on a secure (https) connection. Open SpeakBetter from its https address to use it.")
    : tr("This browser can't use the microphone. Try Chrome, Edge or Safari.");
}

/** Thrown by getMicrophone when the page can't ask for the microphone; its message is ready to show */
export class MicrophoneUnavailableError extends Error {
  readonly support: MicrophoneSupport;
  constructor(support: MicrophoneSupport) {
    super(microphoneUnavailableMessage(support));
    this.name = "MicrophoneUnavailableError";
    this.support = support;
  }
}

export const isMicrophoneUnavailable = (error: unknown): error is MicrophoneUnavailableError =>
  error instanceof MicrophoneUnavailableError;

/**
 * navigator.mediaDevices.getUserMedia({ audio }), but a page that can't use the microphone gets a
 * MicrophoneUnavailableError with a clear message instead of a TypeError. Permission errors (NotAllowedError,
 * NotFoundError…) come through unchanged.
 */
export async function getMicrophone(audio: MediaTrackConstraints | boolean = true): Promise<MediaStream> {
  const support = microphoneSupport();
  if (support !== "ok") throw new MicrophoneUnavailableError(support);
  return navigator.mediaDevices.getUserMedia({ audio });
}

/** The message for any microphone failure: unavailable, blocked, or missing */
export function microphoneErrorMessage(error: unknown): string {
  if (isMicrophoneUnavailable(error)) return error.message;
  const name = (error as { name?: string } | null)?.name;
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return tr("No microphone found. Plug one in or pick another device.");
  }
  return tr("Unable to access microphone. Please check permissions in your browser settings.");
}
