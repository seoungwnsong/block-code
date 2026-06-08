import { Expr } from './permitivedatatypes.js';

export class BinaryOperator extends Expr {
  constructor(left, op, right) {
    super();
    this.left = left;
    this.op = op;
    this.right = right;
  }

  evaluate() {
    const left = this.left.evaluate();
    const right = this.right.evaluate();

    switch (this.op) {
      case "+":  return left + right;
      case "-":  return left - right;
      case "*":  return left * right;
      case "/":
        if (right === 0) throw new Error("Division by zero");
        return left / right;
      case "%":  return left % right;
      case "**": return left ** right;
      case "and": return left && right;
      case "or":  return left || right;
      case "==":  return left === right;
      case "!=":  return left !== right;
      case "<":   return left < right;
      case ">":   return left > right;
      case "<=":  return left <= right;
      case ">=":  return left >= right;
      default:
        throw new Error(`Unknown operator: ${this.op}`);
    }
  }
}

export class Compare extends Expr {
  constructor(left, comparisons) {
    super();
    this.left = left;
    this.comparisons = comparisons;
  }

  evaluate() {
    const x = [];

    if (this.comparisons.length >= 1) {
      const [op, right] = this.comparisons[0];
      const leftVal = this.left.evaluate();
      const rightVal = right.evaluate();

      const ops = {
        "<=": (a, b) => a <= b,
        "<":  (a, b) => a < b,
        ">=": (a, b) => a >= b,
        ">":  (a, b) => a > b,
        "==": (a, b) => a === b,
        "!=": (a, b) => a !== b,
      };

      if (op in ops) {
        x.push(new Bool(ops[op](leftVal, rightVal)));
      } else {
        throw new Error(`Unknown operator: ${op}`);
      }

      if (this.comparisons.slice(1).length >= 1) {
        x.push(new Bool(
          new Compare(this.comparisons[0][1], this.comparisons.slice(1)).evaluate()
        ));
      }
    }

    if (x.length === 1) {
      return x[0].evaluate();
    } else {
      return new BoolOp("and", x).evaluate();
    }
  }
}

export class Bool extends Expr {
  constructor(b) {
    super();
    this.b = b;
  }

  evaluate() {
    return this.b;
  }

  toString() {
    return String(this.b);
  }
}

export class BoolOp extends Expr {
  constructor(op, values) {
    super();
    this.op = op;
    this.values = values;
  }

  evaluate() {
    if (this.op === "and") {
      return this.values.every(i => i.evaluate());
    } else if (this.op === "or") {
      return this.values.some(i => i.evaluate());
    }
    return false;
  }
}