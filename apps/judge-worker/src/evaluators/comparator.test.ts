import { describe, it, expect } from "vitest";
import { compareOutput, normalizeOutput } from "./comparator";

describe("Deterministic Output Comparator Unit Tests", () => {
  it("1. matches identical single-line output", () => {
    expect(compareOutput("Hello World", "Hello World")).toBe(true);
  });

  it("2. matches identical multi-line output", () => {
    const actual = "Line 1\nLine 2\nLine 3";
    const expected = "Line 1\nLine 2\nLine 3";
    expect(compareOutput(actual, expected)).toBe(true);
  });

  it("3. handles CRLF vs LF line endings correctly", () => {
    const actual = "Line 1\r\nLine 2\r\n";
    const expected = "Line 1\nLine 2\n";
    expect(compareOutput(actual, expected)).toBe(true);
  });

  it("4. handles trailing whitespace on individual lines", () => {
    const actual = "42   \n100  \t";
    const expected = "42\n100";
    expect(compareOutput(actual, expected)).toBe(true);
  });

  it("5. handles trailing newlines at end of file", () => {
    const actual = "Result\n\n\n";
    const expected = "Result";
    expect(compareOutput(actual, expected)).toBe(true);
  });

  it("6. rejects output mismatch", () => {
    expect(compareOutput("42", "43")).toBe(false);
  });

  it("7. rejects token-internal whitespace differences", () => {
    // "1 2" vs "1  2" should not be ignored — token spacing matters
    expect(compareOutput("1  2", "1 2")).toBe(false);
  });

  it("8. rejects case sensitivity differences", () => {
    expect(compareOutput("true", "True")).toBe(false);
    expect(compareOutput("ACCEPTED", "accepted")).toBe(false);
  });

  it("9. handles empty string comparison", () => {
    expect(compareOutput("", "")).toBe(true);
    expect(compareOutput("   \n\n", "")).toBe(true);
    expect(compareOutput("not empty", "")).toBe(false);
  });

  it("10. normalizeOutput strips extraneous whitespace properly", () => {
    expect(normalizeOutput("\r\n  line 1  \r\n  line 2  \r\n")).toBe(
      "  line 1\n  line 2",
    );
  });
});
