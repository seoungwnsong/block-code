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
            case "+":
                if (typeof left === "number" && typeof right === "number") {
                    return left + right;
                }
        
                if (typeof left === "string" && typeof right === "string") {
                    return left + right;
                }
        
                throw new TypeError(
                    `Cannot add ${typeof left} and ${typeof right}`
                );
        
            case "-":
            case "*":
            case "/":
            case "%":
            case "**":
                if (typeof left !== "number" || typeof right !== "number") {
                    throw new TypeError(
                        `Operator ${this.op} requires numbers, got ${typeof left} and ${typeof right}`
                    );
                }
        
                if (this.op === "/" && right === 0) {
                    throw new Error("Division by zero");
                }
        
                if (this.op === "-") return left - right;
                if (this.op === "*") return left * right;
                if (this.op === "/") return left / right;
                if (this.op === "%") return left % right;
                if (this.op === "**") return left ** right;
                break;
        
            case "and":
            case "or":
                if (typeof left !== "boolean" || typeof right !== "boolean") {
                    throw new TypeError(
                        `Operator ${this.op} requires booleans, got ${typeof left} and ${typeof right}`
                    );
                }
        
                return this.op === "and" ? left && right : left || right;
        
            case "==":
                return left === right;
        
            case "!=":
                return left !== right;
        
            case "<":
            case ">":
            case "<=":
            case ">=":
                if (typeof left !== typeof right) {
                    throw new TypeError(
                        `Cannot compare ${typeof left} and ${typeof right}`
                    );
                }
        
                if (this.op === "<") return left < right;
                if (this.op === ">") return left > right;
                if (this.op === "<=") return left <= right;
                if (this.op === ">=") return left >= right;
                break;
        
            default:
                throw new Error(`Unknown operator: ${this.op}`);
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
