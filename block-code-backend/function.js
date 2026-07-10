// function.js
// User-defined function support: definitions, calls, and return handling.
//
// This module is intentionally dependency-free. It only defines runtime node
// classes. All block -> node translation (and any string parsing) happens in
// interpreter.js, which builds the expression/statement nodes and passes them
// in here already-built. Keeping this file import-free avoids circular deps.

// ReturnSignal is THROWN by a `return` to unwind execution back to the function
// boundary. It is NOT an error, so anything that catches errors (e.g. try/catch)
// must re-throw it instead of swallowing it. (See TaC in flowstatement.js.)
class ReturnSignal {
    constructor(value) {
        this.value = value;
    }
}

// `return <expr>` — evaluates its value and throws it as a ReturnSignal.
class Return {
    constructor(valueExpr) {
        this.valueExpr = valueExpr; // an Expr-like node, or null for a bare return
    }
    evaluate(env) {
        const value = this.valueExpr ? this.valueExpr.evaluate(env) : undefined;
        throw new ReturnSignal(value);
    }
}

// A registered user-defined function.
// `defEnv` is the scope the function was defined in (normally the global env),
// so the body can read globals and find other functions — Python-like scoping.
class UserFunction {
    constructor(name, params, body, defEnv) {
        this.name = name;     // string
        this.params = params; // array of parameter name strings
        this.body = body;     // array of Statement-like nodes
        this.defEnv = defEnv; // the env the function was defined in
    }
    call(argValues) {
        if (argValues.length !== this.params.length) {
            throw new TypeError(
                `${this.name}() expects ${this.params.length} argument(s), got ${argValues.length}`
            );
        }
        // Fresh local scope. Prototype = defEnv, so variable reads fall through
        // to globals / other functions, while assignments create locals that
        // shadow rather than clobber the outer scope.
        const localEnv = Object.create(this.defEnv);
        for (let i = 0; i < this.params.length; i++) {
            localEnv[this.params[i]] = argValues[i];
        }
        try {
            for (const stmt of this.body) {
                stmt.evaluate(localEnv);
            }
        } catch (signal) {
            if (signal instanceof ReturnSignal) return signal.value;
            throw signal; // a real error — let it propagate to the caller
        }
        return undefined; // reached the end without hitting a return
    }
}

// `call name(args)` — usable as an expression (evaluates to the return value)
// or as a bare statement (the value is simply discarded).
class Call {
    constructor(name, argExprs) {
        this.name = name;         // string
        this.argExprs = argExprs; // array of Expr-like nodes (evaluated in caller's env)
    }
    evaluate(env) {
        const fn = env[this.name];
        if (!(fn instanceof UserFunction)) {
            throw new Error(`Undefined function: ${this.name}`);
        }
        const argValues = this.argExprs.map(a => a.evaluate(env));
        return fn.call(argValues);
    }
}

module.exports = { ReturnSignal, Return, UserFunction, Call };
