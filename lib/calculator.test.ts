import { describe, expect, it } from "vitest";
import { evaluateExpression, formatResult } from "./calculator";

describe("Faliz scientific calculator", () => {
  it("evaluates grouped arithmetic and respects operation precedence", () => {
    expect(evaluateExpression("(2 + 3) * 4", "DEG")).toBe(20);
    expect(evaluateExpression("2 + 3 * 4", "DEG")).toBe(14);
    expect(evaluateExpression("-2^2", "DEG")).toBe(-4);
    expect(evaluateExpression("(-2)^2", "DEG")).toBe(4);
    expect(evaluateExpression("2^3^2", "DEG")).toBe(512);
  });
  it("supports trigonometry in degrees and radians", () => {
    expect(evaluateExpression("sin(30)", "DEG")).toBeCloseTo(0.5);
    expect(evaluateExpression("sin(pi / 6)", "RAD")).toBeCloseTo(0.5);
    expect(evaluateExpression("asin(0.5)", "DEG")).toBeCloseTo(30);
    expect(evaluateExpression("cos(0)", "RAD")).toBe(1);
  });
  it("supports logs, roots, powers, factorial and mathematical constants", () => {
    expect(evaluateExpression("ln(e)", "RAD")).toBeCloseTo(1);
    expect(evaluateExpression("log(1000)", "RAD")).toBeCloseTo(3);
    expect(evaluateExpression("sqrt(81) + 3!", "RAD")).toBe(15);
    expect(evaluateExpression("2pi", "RAD")).toBeCloseTo(2 * Math.PI);
    expect(evaluateExpression("2(3 + 4)", "DEG")).toBe(14);
  });
  it("rejects invalid domains, incomplete expressions and division by zero", () => {
    expect(() => evaluateExpression("1 / 0", "DEG")).toThrow(
      "Cannot divide by zero",
    );
    expect(() => evaluateExpression("(-1)!", "DEG")).toThrow("Factorial");
    expect(() => evaluateExpression("sqrt(-1)", "DEG")).toThrow(
      "outside the supported range",
    );
    expect(() => evaluateExpression("2 +", "DEG")).toThrow();
  });
  it("formats practical answers without floating-point noise", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
    expect(formatResult(-0)).toBe("0");
  });
});
