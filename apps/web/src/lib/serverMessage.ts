/** The message the server sent with a failed request, or "" if it sent none (so callers can fall back to their own wording) */
export function serverMessage(error: unknown): string {
  return (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message?.toString() ?? "";
}
