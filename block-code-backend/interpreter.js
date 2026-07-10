const { Assign, ParallelAssign, Print, If, ForRange, For, While, TaC } = require('./flowstatement');
const { BinaryOperator, Compare, Bool, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');
const { parse } = require('./parser');                          // NEW: parse free-form string expressions
const { Return, UserFunction, Call } = require('./function');   // NEW: user-defined function support

// NEW: build a UserFunction from a `def` block and register it in `env` by name.
function registerDef(block, env) {
    const params = block.params || [];
    const body = (block.children || []).map(toStmt);
    env[block.name] = new UserFunction(block.name, params, body, env);
}

// Turns a block into an Expr node — works recursively for composed expressions
function toExpr(block) {
    if (typeof block === 'number') return new num(block);
    // CHANGED: a raw string is a free-form expression, parsed per the frontend convention:
    //   bare word -> variable ref   |   'quoted' -> string literal   |   number -> number
    //   name(args) -> function call. So "a + b", "add(2, 3)", "n * factorial(n - 1)" all work.
    // (String literals must be single-quoted; a bare word is treated as a variable.)
    if (typeof block === 'string') return parse(block);

    switch (block.type) {
        case 'int':    return new num(Number(block.value));
        case 'float':  return new num(Number(block.value));
        case 'str':    return new Strings(block.value);
        case 'bool':   return new Booleans(block.value === 'true' || block.value === true);

        case 'variable':
            // Read the variable's value from env at runtime
            return { evaluate: (env) => {
                if (!(block.name in env)) throw new Error(`Undefined variable: ${block.name}`);
                return env[block.name];
            }};

        case 'calculation':
            return new BinaryOperator(toExpr(block.left), block.operator, toExpr(block.right));

        case 'compare':
            // Supports chained: { left, comparisons: [{op, right}, ...] }
            // or simple:        { left, operator, right }
            return block.comparisons
                ? new Compare(toExpr(block.left), block.comparisons.map(c => [c.op, toExpr(c.right)]))
                : new Compare(toExpr(block.left), [[block.operator, toExpr(block.right)]]);

        case 'boolop':
            // Recursive: each value in block.values can itself be a composed expression
            return new BoolOp(block.operator, block.values.map(toExpr));

        case 'call':
            // NEW: a function call used as an expression — evaluates to the return value.
            // args may be strings ("n - 1") or nested blocks; toExpr handles both.
            return new Call(block.name, (block.args || []).map(toExpr));

        default:
            // Inline literal with dataType field
            if (block.dataType === 'int' || block.dataType === 'float') return new num(Number(block.value));
            if (block.dataType === 'str')  return new Strings(String(block.value));
            if (block.dataType === 'bool') return new Booleans(block.value === 'true' || block.value === true);
            throw new Error(`Unknown expression block: "${block.type}"`);
    }
}

// Turns a block into a Statement node
function toStmt(block) {
    switch (block.type) {
        case 'variable':     return new Assign(block.name, toExpr({ type: block.dataType, value: block.value }));
        case 'assign':       return new Assign(block.name, toExpr(block.value));
        case 'parallelAssign': return new ParallelAssign(block.names, block.values.map(toExpr));
        case 'print':        return new Print(toExpr(block.value));
        case 'if':           return new If(toExpr(block.condition), block.body.map(toStmt), (block.elseBody ?? []).map(toStmt));
        case 'forRange':     return new ForRange(block.variable, toExpr(block.start), toExpr(block.stop), block.body.map(toStmt));
        case 'for':          return new For(block.variable, toExpr(block.iterable), block.body.map(toStmt));
        case 'while':        return new While(toExpr(block.condition), block.body.map(toStmt));
        case 'tac':          return new TaC(block.body.map(toStmt), block.error, block.handler.map(toStmt));

        // NEW: --- user-defined functions ---
        case 'return':       // value can be a string ("a + b") OR a block ({type:'calculation',...})
            return new Return(
                (block.value === undefined || block.value === null || block.value === '')
                    ? null
                    : toExpr(block.value)
            );
        case 'call':         // bare call statement — runs the function, discards the result
            return new Call(block.name, (block.args || []).map(toExpr));
        case 'def':          // a nested def registers into whatever scope it runs in
            return { evaluate: (env) => registerDef(block, env) };

        default:             throw new Error(`Unknown statement block: "${block.type}"`);
    }
}

function runBlocks(blocks, functions = []) {   // NEW: accept function definitions
    const env = {};
    const output = [];
    const results = [];

    const originalLog = console.log;
    console.log = (...args) => { output.push(args.join(' ')); originalLog(...args); };

    // NEW: register all top-level function definitions BEFORE running the program,
    // so calls (and mutual recursion) resolve regardless of block order.
    for (const def of (functions || [])) {
        try {
            registerDef(def, env);
        } catch (err) {
            results.push({ id: def.id, status: 'error', message: err.message });
        }
    }

    for (const block of blocks) {
        // NEW: a `def` may also arrive inside `blocks` — register it, don't "run" it.
        if (block.type === 'def') {
            try {
                registerDef(block, env);
                results.push({ id: block.id, status: 'ok' });
            } catch (err) {
                results.push({ id: block.id, status: 'error', message: err.message });
            }
            continue;
        }

        try {
            const value = toStmt(block).evaluate(env);
            const entry = { id: block.id, status: 'ok' };
            // NEW: surface a top-level call's return value so it isn't silently lost.
            if (block.type === 'call' && value !== undefined) entry.value = value;
            results.push(entry);
        } catch (err) {
            results.push({ id: block.id, status: 'error', message: err.message });
        }
    }

    console.log = originalLog;

    // NEW: don't leak UserFunction objects into the variables response.
    const variables = {};
    for (const key of Object.keys(env)) {
        if (!(env[key] instanceof UserFunction)) variables[key] = env[key];
    }

    return { variables, output, results };
}

module.exports = { runBlocks };
