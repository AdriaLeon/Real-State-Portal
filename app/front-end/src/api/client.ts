import type { ApiErrorBody } from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// Centralized GET helper: builds the URL, parses JSON, and normalizes both
// backend error responses ({error: string}) and network failures into
// ApiError so callers never touch raw fetch/Response objects.
export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQueryString(params)}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("Network error: could not reach the server", 0);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON; keep the generic message
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
