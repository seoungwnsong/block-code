// Signal thrown to unwind out of a function body when `return` runs.
// It is NOT an Error, so try/catch blocks must re-throw it (see flowstatement TaC).
class ReturnSignal {
    constructor(value) {
        this.value = value;
    }
}

// A registered, callable user-defined function.
// `body` is an array of already-built Statement nodes (converted in interpreter.js).
class UserFunction {
    constructor(name, params, body) {
        this.name = name;
        this.params = params;
        this.body = body;
        this.globalEnv = null;   // set at registration so functions can call each other
    }

    call(argValues) {
        if (argValues.length !== this.params.length) {
            throw new Error(`Function ${this.name} expects ${this.params.length} argument(s), got ${argValues.length}`);
        }

        // Fresh local scope. Seed it with the other registered functions
        // (supports nested / recursive / mutually recursive calls), then bind params.
        const localEnv = {};
        if (this.globalEnv) {
            for (const key in this.globalEnv) {
                if (this.globalEnv[key] instanceof UserFunction) localEnv[key] = this.globalEnv[key];
            }
        }
        for (let i = 0; i < this.params.length; i++) {
            localEnv[this.params[i]] = argValues[i];
        }

        try {
            for (const stmt of this.body) stmt.evaluate(localEnv);
        } catch (e) {
            if (e instanceof ReturnSignal) return e.value;
            throw e;
        }
        return undefined;   // function with no explicit return
    }
}

// `return <expr>` — evaluates its value, then unwinds via ReturnSignal.
class Return {
    constructor(value) {
        this.value = value;   // an Expr
    }
    evaluate(env) {
        throw new ReturnSignal(this.value.evaluate(env));
    }
}

// `call` in an expression position — looks up the function by name,
// evaluates its arguments in the caller's env, then runs it.
class Call {
    constructor(name, args) {
        this.name = name;
        this.args = args;     // array of Expr
    }
    evaluate(env) {
        const fn = env[this.name];
        if (!(fn instanceof UserFunction)) {
            throw new Error(`Undefined function: ${this.name}`);
        }
        const argValues = this.args.map(a => a.evaluate(env));
        return fn.call(argValues);
    }
}

module.exports = { ReturnSignal, UserFunction, Return, Call };
