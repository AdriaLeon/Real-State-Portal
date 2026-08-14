import { describe, expect, it } from "vitest";
import {
  parseBooleanParam,
  parseEnumParam,
  parseFloatParam,
  parseIntParam,
  parsePagination,
  parseStringParam,
  QueryParamError,
} from "../../lib/api/queryParams.js";

describe("parseIntParam", () => {
  it("parses a valid integer", () => {
    expect(parseIntParam("3", "rooms")).toBe(3);
  });

  it("returns undefined when absent", () => {
    expect(parseIntParam(undefined, "rooms")).toBeUndefined();
  });

  it("throws on non-integer input", () => {
    expect(() => parseIntParam("3.5", "rooms")).toThrow(QueryParamError);
    expect(() => parseIntParam("abc", "rooms")).toThrow(QueryParamError);
  });

  it("throws when the param is repeated", () => {
    expect(() => parseIntParam(["1", "2"], "rooms")).toThrow(QueryParamError);
  });
});

describe("parseFloatParam", () => {
  it("parses a valid float", () => {
    expect(parseFloatParam("51.3", "area")).toBe(51.3);
  });

  it("returns undefined when absent", () => {
    expect(parseFloatParam(undefined, "area")).toBeUndefined();
  });

  it("throws on non-numeric input", () => {
    expect(() => parseFloatParam("abc", "area")).toThrow(QueryParamError);
  });
});

describe("parseBooleanParam", () => {
  it("parses 'true' and 'false'", () => {
    expect(parseBooleanParam("true", "hasElevator")).toBe(true);
    expect(parseBooleanParam("false", "hasElevator")).toBe(false);
  });

  it("returns undefined when absent", () => {
    expect(parseBooleanParam(undefined, "hasElevator")).toBeUndefined();
  });

  it("throws on anything else", () => {
    expect(() => parseBooleanParam("1", "hasElevator")).toThrow(QueryParamError);
    expect(() => parseBooleanParam("yes", "hasElevator")).toThrow(QueryParamError);
  });
});

describe("parseStringParam", () => {
  it("trims and returns a valid string", () => {
    expect(parseStringParam(" Kraków ", "city")).toBe("Kraków");
  });

  it("treats an empty string as absent", () => {
    expect(parseStringParam("", "city")).toBeUndefined();
  });

  it("returns undefined when absent", () => {
    expect(parseStringParam(undefined, "city")).toBeUndefined();
  });
});

describe("parseEnumParam", () => {
  const ALLOWED = ["primary", "secondary"] as const;

  it("accepts an allowed value", () => {
    expect(parseEnumParam("primary", "marketType", ALLOWED)).toBe("primary");
  });

  it("returns undefined when absent", () => {
    expect(parseEnumParam(undefined, "marketType", ALLOWED)).toBeUndefined();
  });

  it("throws on a value outside the allowed set", () => {
    expect(() => parseEnumParam("rental", "marketType", ALLOWED)).toThrow(QueryParamError);
  });
});

describe("parsePagination", () => {
  it("defaults to page 1, limit 20", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("computes skip from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("throws when page is less than 1", () => {
    expect(() => parsePagination({ page: "0" })).toThrow(QueryParamError);
  });

  it("throws when limit exceeds the max", () => {
    expect(() => parsePagination({ limit: "101" })).toThrow(QueryParamError);
  });

  it("throws when limit is less than 1", () => {
    expect(() => parsePagination({ limit: "0" })).toThrow(QueryParamError);
  });
});
