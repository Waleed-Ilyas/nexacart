import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents, money, moneyWhole } from "./format";

describe("money", () => {
  it("formats integer cents as dollars", () => {
    expect(money(0)).toBe("$0.00");
    expect(money(5)).toBe("$0.05");
    expect(money(1999)).toBe("$19.99");
    expect(money(123456789)).toBe("$1,234,567.89");
    expect(moneyWhole(12900)).toBe("$129");
  });
});

describe("dollarsToCents", () => {
  it("parses whole and two-decimal amounts exactly", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents("19")).toBe(1900);
    expect(dollarsToCents("0.5")).toBe(50);
    expect(dollarsToCents("$25.50")).toBe(2550);
    expect(dollarsToCents(" 7 ")).toBe(700);
  });
  it("is exact where floating point is not", () => {
    // 0.1 + 0.2 style traps: 1.15 * 100 is 114.99999999999999 in JavaScript
    expect(dollarsToCents("1.15")).toBe(115);
    expect(dollarsToCents("4.35")).toBe(435);
    expect(dollarsToCents("8.2")).toBe(820);
  });
  it("rejects anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.999", "1e3", "1,50", ".5", "5.", "1..2", "$", "NaN"]) expect(dollarsToCents(bad), bad).toBeNull();
  });
  it("round-trips with centsToDollars", () => {
    for (const c of [1, 99, 100, 1999, 12345]) expect(dollarsToCents(centsToDollars(c))).toBe(c);
  });
});
