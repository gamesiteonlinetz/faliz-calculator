export type AngleMode = "DEG" | "RAD";

type Token = {
  type: "number" | "operator" | "identifier" | "left" | "right" | "comma";
  value: string;
};

function tokenize(source: string): Token[] {
  const normalized = source
    .replace(/[×·]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/\^/g, "^");
  const raw: Token[] = [];
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let value = "";
      let dots = 0;
      while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
        if (normalized[i] === ".") dots += 1;
        value += normalized[i++];
      }
      if (dots > 1 || value === ".") throw new Error("Invalid number");
      raw.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let value = "";
      while (i < normalized.length && /[a-zA-Z]/.test(normalized[i]))
        value += normalized[i++];
      raw.push({ type: "identifier", value: value.toLowerCase() });
      continue;
    }
    if (char === "(") raw.push({ type: "left", value: char });
    else if (char === ")") raw.push({ type: "right", value: char });
    else if (char === ",") raw.push({ type: "comma", value: char });
    else if ("+-*/%^!".includes(char))
      raw.push({ type: "operator", value: char });
    else throw new Error("Unsupported character");
    i += 1;
  }

  // Make common calculator notation work naturally: 2π, 3(4+1), and (2)(3).
  const tokens: Token[] = [];
  for (const token of raw) {
    const previous = tokens[tokens.length - 1];
    const leftCanEnd =
      previous &&
      (previous.type === "number" ||
        previous.type === "right" ||
        (previous.type === "identifier" &&
          ["pi", "e"].includes(previous.value)) ||
        (previous.type === "operator" && previous.value === "!"));
    const rightCanStart =
      token.type === "number" ||
      token.type === "left" ||
      (token.type === "identifier" && ["pi", "e"].includes(token.value));
    if (leftCanEnd && rightCanStart)
      tokens.push({ type: "operator", value: "*" });
    tokens.push(token);
  }
  return tokens;
}

export function evaluateExpression(
  source: string,
  angleMode: AngleMode,
): number {
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = () => tokens[cursor++];
  const toRadians = (n: number) =>
    angleMode === "DEG" ? (n * Math.PI) / 180 : n;
  const fromRadians = (n: number) =>
    angleMode === "DEG" ? (n * 180) / Math.PI : n;
  const factorial = (n: number): number => {
    if (!Number.isInteger(n) || n < 0 || n > 170)
      throw new Error("Factorial requires an integer from 0 to 170");
    let answer = 1;
    for (let i = 2; i <= n; i += 1) answer *= i;
    return answer;
  };
  const applyFunction = (name: string, value: number): number => {
    switch (name) {
      case "sin":
        return Math.sin(toRadians(value));
      case "cos":
        return Math.cos(toRadians(value));
      case "tan":
        return Math.tan(toRadians(value));
      case "asin":
        return fromRadians(Math.asin(value));
      case "acos":
        return fromRadians(Math.acos(value));
      case "atan":
        return fromRadians(Math.atan(value));
      case "sqrt":
        return Math.sqrt(value);
      case "ln":
        return Math.log(value);
      case "log":
        return Math.log10(value);
      case "abs":
        return Math.abs(value);
      case "inv":
        return 1 / value;
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  };

  function primary(): number {
    const token = peek();
    if (!token) throw new Error("Incomplete expression");
    if (token.type === "number") {
      consume();
      return Number(token.value);
    }
    if (token.type === "left") {
      consume();
      const value = addSubtract();
      if (peek()?.type !== "right")
        throw new Error("Missing closing parenthesis");
      consume();
      return value;
    }
    if (token.type === "identifier") {
      consume();
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      if (peek()?.type !== "left") throw new Error(`Use ${token.value}(…)`);
      consume();
      const value = addSubtract();
      if (peek()?.type !== "right")
        throw new Error("Missing closing parenthesis");
      consume();
      return applyFunction(token.value, value);
    }
    throw new Error("Expected a number");
  }

  function postfix(): number {
    let value = primary();
    while (peek()?.type === "operator" && peek()?.value === "!") {
      consume();
      value = factorial(value);
    }
    return value;
  }
  function exponent(): number {
    const base = postfix();
    if (peek()?.type === "operator" && peek()?.value === "^") {
      consume();
      return base ** unary();
    }
    return base;
  }
  function unary(): number {
    if (
      peek()?.type === "operator" &&
      (peek()?.value === "+" || peek()?.value === "-")
    ) {
      const sign = consume().value === "-" ? -1 : 1;
      return sign * unary();
    }
    return exponent();
  }
  function multiplyDivide(): number {
    let value = unary();
    while (
      peek()?.type === "operator" &&
      ["*", "/", "%"].includes(peek()!.value)
    ) {
      const op = consume().value;
      const right = unary();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero");
      value =
        op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  }
  function addSubtract(): number {
    let value = multiplyDivide();
    while (peek()?.type === "operator" && ["+", "-"].includes(peek()!.value)) {
      const op = consume().value;
      const right = multiplyDivide();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  if (!tokens.length) throw new Error("Enter an expression");
  const result = addSubtract();
  if (cursor !== tokens.length) throw new Error("Check the expression");
  if (!Number.isFinite(result))
    throw new Error("Result is outside the supported range");
  return result;
}

export function formatResult(value: number): string {
  if (Object.is(value, -0) || Math.abs(value) < 1e-12) return "0";
  const rounded = Number(value.toPrecision(12));
  return rounded.toLocaleString("en-US", {
    maximumFractionDigits: 10,
    useGrouping: false,
  });
}
