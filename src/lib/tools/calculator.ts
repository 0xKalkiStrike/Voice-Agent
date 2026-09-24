/**
 * Safe arithmetic evaluator — shunting-yard to RPN, no eval(), no shell, no
 * arbitrary code. This is the "calculator" tool's execution engine and is
 * testable in isolation.
 */

const MAX_LENGTH = 80;
const ALLOWED = /^[0-9+\-*/().%\s]+$/;

type Tok =
  | { kind: "num"; value: number }
  | { kind: "op"; value: string }; // + - * / % ( ) ~unary

export function calculate(expression: string): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new Error("empty expression");
  const value = evaluateRpn(toRpn(tokens));
  if (!Number.isFinite(value)) throw new Error("result is not a finite number");
  return value;
}

function tokenize(expression: string): Tok[] {
  const expr = expression.trim();
  if (expr.length === 0) throw new Error("empty expression");
  if (expr.length > MAX_LENGTH) throw new Error("expression too long");
  if (!ALLOWED.test(expr)) throw new Error("expression contains unsupported characters");

  const tokens: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      const raw = expr.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`invalid number "${raw}"`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if ("+-*/%()".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${ch}"`);
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "~": 3, // unary minus
};

function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const ops: string[] = [];
  let prev: Tok | undefined;

  for (const tok of tokens) {
    if (tok.kind === "num") {
      out.push(tok);
    } else {
      const op = tok.value;
      if (op === "(") {
        ops.push(op);
      } else if (op === ")") {
        while (ops.length > 0 && ops[ops.length - 1] !== "(") {
          out.push({ kind: "op", value: ops.pop() as string });
        }
        if (ops.pop() !== "(") throw new Error("mismatched parentheses");
      } else {
        if (
          op === "-" &&
          (!prev || (prev.kind === "op" && prev.value !== ")"))
        ) {
          ops.push("~");
        } else {
          while (
            ops.length > 0 &&
            ops[ops.length - 1] !== "(" &&
            PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[op]
          ) {
            out.push({ kind: "op", value: ops.pop() as string });
          }
          ops.push(op);
        }
      }
    }
    prev = tok;
  }
  while (ops.length > 0) {
    const op = ops.pop() as string;
    if (op === "(" || op === ")") throw new Error("mismatched parentheses");
    out.push({ kind: "op", value: op });
  }
  return out;
}

function applyBinary(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new Error("division by zero");
      return a / b;
    case "%":
      if (b === 0) throw new Error("modulo by zero");
      return a % b;
    default:
      throw new Error(`unknown operator "${op}"`);
  }
}

function evaluateRpn(rpn: Tok[]): number {
  const stack: number[] = [];
  for (const tok of rpn) {
    if (tok.kind === "num") {
      stack.push(tok.value);
    } else if (tok.value === "~") {
      const a = stack.pop();
      if (a === undefined) throw new Error("malformed unary minus");
      stack.push(-a);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("malformed expression");
      stack.push(applyBinary(a, b, tok.value));
    }
  }
  if (stack.length !== 1) throw new Error("could not fully evaluate");
  return stack[0];
}