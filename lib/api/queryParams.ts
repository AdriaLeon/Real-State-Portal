// Pure, framework-agnostic parsers for values coming out of Express's
// req.query (string | string[] | ParsedQs | ParsedQs[] | undefined).
//
// Each throws a QueryParamError with a human-readable message on invalid
// input rather than silently ignoring or coercing it — a malformed filter
// silently dropped would return a confusingly wrong result set instead of an
// obvious 400.

export class QueryParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryParamError";
  }
}

// Rejects repeated params (?city=A&city=B) rather than silently taking the
// first — most likely a client bug, not intentional.
function asSingleString(raw: unknown, name: string): string | undefined {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) throw new QueryParamError(`"${name}" must be given only once`);
  if (typeof raw !== "string") throw new QueryParamError(`"${name}" must be a string`);
  return raw;
}

// "3" -> 3. Throws on non-integer input.
export function parseIntParam(raw: unknown, name: string): number | undefined {
  const str = asSingleString(raw, name);
  if (str === undefined) return undefined;
  if (!/^-?\d+$/.test(str.trim())) throw new QueryParamError(`"${name}" must be an integer, got "${str}"`);
  return parseInt(str, 10);
}

// "51.3" -> 51.3. Throws on non-numeric input.
export function parseFloatParam(raw: unknown, name: string): number | undefined {
  const str = asSingleString(raw, name);
  if (str === undefined) return undefined;
  const num = Number(str.trim());
  if (str.trim() === "" || Number.isNaN(num)) throw new QueryParamError(`"${name}" must be a number, got "${str}"`);
  return num;
}

// "true"/"false" -> boolean. Throws on anything else (no "1"/"0"/"yes" fuzzing).
export function parseBooleanParam(raw: unknown, name: string): boolean | undefined {
  const str = asSingleString(raw, name);
  if (str === undefined) return undefined;
  if (str === "true") return true;
  if (str === "false") return false;
  throw new QueryParamError(`"${name}" must be "true" or "false", got "${str}"`);
}

// Trims; treats "" as absent (?city= is not a filter).
export function parseStringParam(raw: unknown, name: string): string | undefined {
  const str = asSingleString(raw, name);
  if (str === undefined) return undefined;
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseEnumParam<T extends string>(raw: unknown, name: string, allowed: readonly T[]): T | undefined {
  const str = parseStringParam(raw, name);
  if (str === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(str)) {
    throw new QueryParamError(`"${name}" must be one of: ${allowed.join(", ")} (got "${str}")`);
  }
  return str as T;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100; // hard cap so a client can't force a full-table scan/response

export function parsePagination(query: { page?: unknown; limit?: unknown }): Pagination {
  const page = parseIntParam(query.page, "page") ?? DEFAULT_PAGE;
  const limit = parseIntParam(query.limit, "limit") ?? DEFAULT_LIMIT;

  if (page < 1) throw new QueryParamError(`"page" must be at least 1, got ${page}`);
  if (limit < 1 || limit > MAX_LIMIT) throw new QueryParamError(`"limit" must be between 1 and ${MAX_LIMIT}, got ${limit}`);

  return { page, limit, skip: (page - 1) * limit };
}
