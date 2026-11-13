// apps/web/src/lib/api/errors.ts
/**
 * What a failed request looks like to the app. Axios errors carry the server's answer in `response`; other
 * failures (network down, code bugs) have only a `message`. Everything is optional, so reading it never throws.
 */
export interface ApiError {
  message?: string;
  code?: string;
  name?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      code?: string;
      error?: string;
      [key: string]: unknown;
    };
  };
}

/** Treat anything thrown as a possible API error (catch blocks receive `unknown`) */
export const asApiError = (error: unknown): ApiError => (error && typeof error === "object" ? (error as ApiError) : {});

/** The server's own message when it sent one, else the fallback */
export const apiErrorMessage = (error: unknown, fallback: string): string => {
  const message = asApiError(error).response?.data?.message as unknown;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
};

export const apiErrorStatus = (error: unknown): number | undefined => asApiError(error).response?.status;
