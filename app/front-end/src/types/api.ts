// Shape of every error response from the backend's centralized error
// handler (app/api/app.ts, repo root) — both the QueryParamError 400 path
// and the generic 500 path return { error: string }.
export interface ApiErrorBody {
  error: string;
}
