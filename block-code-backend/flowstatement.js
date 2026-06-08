class Statement {
    evaluate() {}
}

class If extends Statement {
    constructor(test, body, orelse) {
        super();
        this.test = test;
        this.body = body;
        this.orelse = orelse;
    }
    evaluate(env) {
        if (this.test.evaluate(env)) {
            for (let i = 0; i < this.body.length; i++) {
                this.body[i].evaluate(env);
            }
        } else {
            for (let i = 0; i < this.orelse.length; i++) {
                this.orelse[i].evaluate(env);
            }
        }
    }
}

class Assign extends Statement {
    constructor(target, value) {
        super();
        this.target = target;
        this.value = value;
    }
    evaluate(env) {
        env[this.target] = this.value.evaluate(env);
    }
}

class ParallelAssign extends Statement {
    constructor(targets, values) {
        super();
        this.targets = targets;
        this.values = values;
    }
    evaluate(env) {
        if (this.targets.length !== this.values.length) {
            throw new TypeError("Targets and values must be same length");
        }
        const temp = {};
        for (let i = 0; i < this.values.length; i++) {
            temp[this.targets[i]] = this.values[i].evaluate(env);
        }
        for (const key in temp) {
            env[key] = temp[key];
        }
    }
}

class Print extends Statement {
    constructor(value) {
        super();
        this.value = value;
    }
    evaluate(env) {
        console.log(this.value.evaluate(env));
    }
}

class ForRange extends Statement {
    constructor(target, start, stop, body) {
        super();
        this.target = target;
        this.start = start;
        this.stop = stop;
        this.body = body;
    }
    evaluate(env) {
        const startVal = this.start.evaluate(env);
        const stopVal = this.stop.evaluate(env);
        if (!Number.isInteger(startVal) || !Number.isInteger(stopVal)) {
            throw new TypeError("start and stop must be integers");
        }
        for (let i = startVal; i < stopVal; i++) {
            env[this.target] = i;
            for (const j of this.body) {
                j.evaluate(env);
            }
        }
    }
}

class For extends Statement {
    constructor(target, iter, body) {
        super();
        this.target = target;
        this.iter = iter;
        this.body = body;
    }
    evaluate(env) {
        const iterVal = this.iter.evaluate(env);
        if (!Array.isArray(iterVal)) {
            throw new TypeError("For loop requires an iterable array");
        }
        for (const item of iterVal) {
            env[this.target] = item;
            for (const stmt of this.body) {
                stmt.evaluate(env);
            }
        }
    }
}

class While extends Statement {
    constructor(test, body) {
        super();
        this.test = test;
        this.body = body;
    }
    evaluate(env) {
        while (this.test.evaluate(env)) {
            for (const stmt of this.body) {
                stmt.evaluate(env);
            }
        }
    }
}

class TaC extends Statement {
    constructor(body, error, handler) {
        super();
        this.body = body;
        this.error = error;
        this.handler = handler;
    }
    evaluate(env) {
        try {
            for (const stmt of this.body) {
                stmt.evaluate(env);
            }
        } catch (e) {
            env[this.error] = e;
            for (const stmt of this.handler) {
                stmt.evaluate(env);
            }
        }
    }
}

module.exports = { If, Assign, ParallelAssign, Print, ForRange, For, While, TaC };

