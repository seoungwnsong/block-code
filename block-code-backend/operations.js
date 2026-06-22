const { Expr } = require('./permitivedatatypes');

class BinaryOperator extends Expr {
    constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
    }
    evaluate(env) {
        const left = this.left.evaluate(env);
        const right = this.right.evaluate(env);
        switch (this.op) {
            case "+":   return left + right;
            case "-":   return left - right;
            case "*":   return left * right;
            case "/":
                if (right === 0) throw new Error("Division by zero");
                return left / right;
            case "%":   return left % right;
            case "**":  return left ** right;
            case "and": return left && right;
            case "or":  return left || right;
            case "==":  return left === right;
            case "!=":  return left !== right;
            case "<":   return left < right;
            case ">":   return left > right;
            case "<=":  return left <= right;
            case ">=":  return left >= right;
            default:    throw new Error(`Unknown operator: ${this.op}`);
        }
    }
}

class Compare extends Expr {
    // comparisons: array of [op, rightExpr] pairs
    // e.g. Compare(x, [["<", y], ["<", z]])  means x < y < z
    constructor(left, comparisons) {
        super();
        this.left = left;
        this.comparisons = comparisons;
    }
    evaluate(env) {
        let current = this.left.evaluate(env);
        for (const [op, rightExpr] of this.comparisons) {
            const right = rightExpr.evaluate(env);
            const ops = {
                "==": (a, b) => a === b,
                "!=": (a, b) => a !== b,
                "<":  (a, b) => a < b,
                ">":  (a, b) => a > b,
                "<=": (a, b) => a <= b,
                ">=": (a, b) => a >= b,
            };
            if (!(op in ops)) throw new Error(`Unknown operator: ${op}`);
            if (!ops[op](current, right)) return false;
            current = right;
        }
        return true;
    }
}

class Bool extends Expr {
    constructor(b) {
        super();
        this.b = b;
    }
    evaluate() { return this.b; }
    toString() { return String(this.b); }
}

class BoolOp extends Expr {
    constructor(op, values) {
        super();
        this.op = op;
        this.values = values;
    }
    evaluate(env) {
        if (this.op === "and") return this.values.every(v => v.evaluate(env));
        if (this.op === "or")  return this.values.some(v  => v.evaluate(env));
        return false;
    }
}

module.exports = { BinaryOperator, Compare, Bool, BoolOp };