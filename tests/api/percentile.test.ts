import { describe, expect, it } from "vitest";
import { percentile } from "../../lib/api/percentile.js";

describe("percentile", () => {
  const values = [10, 20, 30, 40];

  it("returns the minimum at p0", () => {
    expect(percentile(values, 0)).toBe(10);
  });

  it("interpolates at p25", () => {
    expect(percentile(values, 25)).toBe(17.5);
  });

  it("interpolates at p50", () => {
    expect(percentile(values, 50)).toBe(25);
  });

  it("interpolates at p75", () => {
    expect(percentile(values, 75)).toBe(32.5);
  });

  it("returns the maximum at p100", () => {
    expect(percentile(values, 100)).toBe(40);
  });

  it("lands exactly on the middle element of an odd-length array at p50", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7], 50)).toBe(4);
  });

  it("returns the sole element of a single-element array for any p", () => {
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it("throws on an empty array", () => {
    expect(() => percentile([], 50)).toThrow();
  });

  it("throws when p is outside [0, 100]", () => {
    expect(() => percentile(values, -1)).toThrow();
    expect(() => percentile(values, 101)).toThrow();
  });
});
