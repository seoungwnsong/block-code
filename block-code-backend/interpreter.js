const {
    Assign, ParallelAssign, Print, If, ForRange, For, While, TaC, ExpressionStatement
} = require('./flowstatement');
const { BinaryOperator, Compare, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');
const { parse } = require('./parser');
const { UserFunction, Return, Call } = require('./function');   // #11, #12, #13
const { NameError, ValueError } = require('./errors');          // B4

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

// #3 / #4: one place that turns a dataType + raw value into an Expr node.
// Accepts both the frontend's "string" and the older backend "str".
function literalExpr(dataType, value) {
    switch (dataType) {
        case 'int':
        case 'float': {
            const n = Number(value);
            // B4: Python's int('abc') raises ValueError, not a bare Error.
            if (Number.isNaN(n)) throw new ValueError(`Invalid ${dataType} literal: ${value}`);
            return new num(n);
        }
        case 'bool':
            return new Booleans(value === true || value === 'true');
        case 'string':
        case 'str':
            return new Strings(String(value));
        default:
            throw new Error(`Unknown literal data type: ${dataType}`);
    }
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

// Turns a block into an Expr node — works recursively for composed expressions
function toExpr(block) {
    if (block === null || block === undefined) {
        throw new Error('Missing expression: expected a value block, got nothing');
    }
    if (typeof block === 'number')  return new num(block);
    if (typeof block === 'boolean') return new Booleans(block);
    // A bare string in an expression slot is parsed, not guessed.
    // Quoting convention: bare word -> variable, 'quoted' -> string literal,
    // bare number -> number. Supports and/or/not, comparisons, nesting.
    if (typeof block === 'string')  return parse(block);

    switch (block.type) {
        // #3: the frontend wraps every typed value as { type:'literal', dataType, value }
        case 'literal':
            return literalExpr(block.dataType, block.value);

        // Older backend shorthand, still accepted
        case 'int':
        case 'float':
        case 'bool':
        case 'str':
        case 'string':
            return literalExpr(block.type, block.value);

        // #5: the frontend reads a variable with { type:'variableReference', name }.
        // 'variable' is kept here only for older payloads; in a STATEMENT slot
        // 'variable' means assignment (see toStmt).
        case 'variableReference':
        case 'variable':
            return { evaluate: (env) => {
                if (!Object.hasOwn(env, block.name)) throw new NameError(`name '${block.name}' is not defined`);   // #20, B4
                return env[block.name];
            }};

        case 'expression':
            // Free-form string routed through parser.js.
            //   bare word  -> variable reference     ("A"    -> env.A)
            //   'quoted'   -> string literal         ("'hi'" -> "hi")
            //   bare number-> numeric literal        ("5"    -> 5)
            return parse(block.value);

        case 'calculation':
            return new BinaryOperator(toExpr(block.left), block.operator, toExpr(block.right));

        // #6: the frontend collapses comparisons AND boolean ops into 'logic'
        case 'logic': {
            const op = block.operator;
            if (op === 'and' || op === 'or') {
                return new BoolOp(op, [toExpr(block.left), toExpr(block.right)]);
            }
            return new Compare(toExpr(block.left), [[op, toExpr(block.right)]]);
        }

        case 'compare':
            // Chained: { left, comparisons: [{op, right}, ...] }
            // Simple:  { left, operator, right }
            return block.comparisons
                ? new Compare(toExpr(block.left), block.comparisons.map(c => [c.op, toExpr(c.right)]))
                : new Compare(toExpr(block.left), [[block.operator, toExpr(block.right)]]);

        case 'boolop': {
            const op = block.operator;
            if (op !== 'and' && op !== 'or') {
                throw new ValueError(`boolop operator must be "and" or "or", got: "${op}"`);
            }
            if (!Array.isArray(block.values) || block.values.length < 2) {
                throw new ValueError('boolop requires a "values" array of at least 2 expressions');
            }
            return new BoolOp(op, block.values.map(toExpr));
        }

        case 'not': {
            if (block.value === undefined) throw new ValueError('not block requires a "value"');
            const operand = toExpr(block.value);
            return { evaluate: (env) => !operand.evaluate(env) };
        }

        // #12: user-defined function call. functionId / paramNames are frontend
        // metadata; the runtime resolves by name.
        case 'call':
            return new Call(block.name, (block.args ?? []).map(toExpr));

        default:
            // Inline literal carrying dataType beside value
            if (block.dataType !== undefined) return literalExpr(block.dataType, block.value);
            throw new Error(`Unknown expression block: "${block.type}"`);
    }
}

// For statement slots where dataType may sit BESIDE value rather than wrapping it,
// e.g. { type:'print', value:'hello', dataType:'str' }.
function valueExpr(block) {
    const v = block.value;
    const isScalar = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
    if (block.dataType !== undefined && isScalar) {
        return literalExpr(block.dataType, v);
    }
    return toExpr(v);
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

// #7 / #8 / #10: the frontend names container arrays `children`,
// `tryChildren`, `catchChildren`. Older payloads used `body` / `handler`.
// Both are accepted so nothing in flight breaks.
function pick(...candidates) {
    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
}

// #16: toStmt is built per-run so Print can be handed this run's output array
// instead of the whole server monkey-patching global console.log.
function makeToStmt(output) {
    function toStmt(block) {
        if (!block || typeof block !== 'object') {
            throw new Error('Invalid statement block');
        }

        switch (block.type) {
            // #2: the frontend nests the type inside value:
            //     { type:'variable', name:'x', value:{ type:'literal', dataType:'int', value:3 } }
            // valueExpr still handles the older flat { name, dataType, value } form.
            case 'variable':
                return new Assign(block.name, valueExpr(block));

            case 'assign':
                return new Assign(block.name, valueExpr(block));

            case 'parallelAssign':
                return new ParallelAssign(block.names, block.values.map(toExpr));

            case 'print':
                return new Print(valueExpr(block), output);

            case 'if':
                // elseChildren is read if the frontend ever adds one; empty until then.
                return new If(
                    toExpr(block.condition),
                    pick(block.children, block.body).map(toStmt),
                    pick(block.elseChildren, block.elseBody).map(toStmt)
                );

            case 'while':
                return new While(
                    toExpr(block.condition),
                    pick(block.children, block.body).map(toStmt)
                );

            // #9: the frontend's `for` is a RANGE loop (variable/start/end),
            // which maps to ForRange — not to For (iterate-an-array).
            case 'for':
            case 'forRange':
                return new ForRange(
                    block.variable ?? block.target,
                    toExpr(block.start),
                    toExpr(block.end ?? block.stop),
                    pick(block.children, block.body).map(toStmt)
                );

            // The iterate-an-array loop has no frontend producer yet; kept under
            // its own tag so the class stays reachable if one is agreed on.
            case 'forIn':
                return new For(
                    block.variable ?? block.target,
                    toExpr(block.iterable),
                    pick(block.children, block.body).map(toStmt)
                );

            case 'tryCatch':
            case 'tac':
                return new TaC(
                    pick(block.tryChildren, block.body).map(toStmt),
                    block.catchErrorName ?? block.error,
                    pick(block.catchChildren, block.handler).map(toStmt)
                );

            // #11
            case 'return':
                return new Return(toExpr(block.value));

            // #14: bare expressions used as statements (a call for its side effects)
            case 'calculation':
            case 'logic':
            case 'call':
                return new ExpressionStatement(toExpr(block));

            default:
                throw new Error(`Unknown statement block: "${block.type}"`);
        }
    }
    return toStmt;
}

// ---------------------------------------------------------------------------
// Program execution
// ---------------------------------------------------------------------------

// #1: accepts the whole request body { functions, blocks }.
// A bare array is still accepted so older callers keep working.
function runProgram(program) {
    const source  = Array.isArray(program) ? { blocks: program } : (program ?? {});
    const rawFns  = Array.isArray(source.functions) ? source.functions : [];
    const rawBlks = Array.isArray(source.blocks)    ? source.blocks    : [];

    const env     = Object.create(null);   // #20
    const output  = [];
    const results = [];
    const toStmt  = makeToStmt(output);

    // A `def` normally arrives in `functions`, but tolerate one sitting in `blocks`.
    const defs   = [...rawFns, ...rawBlks.filter(b => b && b.type === 'def')];
    const blocks = rawBlks.filter(b => b && b.type !== 'def');

    // #13: register EVERY function before executing anything, so call order is
    // free and recursion / mutual recursion resolve.
    // B4: Python stops at the first uncaught error. `halted` is set as soon as
    // one is reported, and nothing after it runs — so `x = 1/0` followed by
    // `print(x)` yields ONE error, not two. Note this means results.length can
    // now be shorter than the number of blocks sent: a block with no entry was
    // never reached.
    let halted = false;

    for (const def of defs) {
        try {
            env[def.name] = new UserFunction(
                def.name,
                def.params ?? [],
                pick(def.children, def.body).map(toStmt)
            );
            results.push({ id: def.id, status: 'ok' });
        } catch (err) {
            // A def that won't even build is a definition-time failure —
            // Python would never reach the program body either.
            results.push({ id: def.id, status: 'error', errorType: err.name || 'Error', message: err.message });
            halted = true;
            break;
        }
    }
    for (const value of Object.values(env)) {
        if (value instanceof UserFunction) value.globalEnv = env;
    }

    if (!halted) {
        for (const block of blocks) {
            try {
                toStmt(block).evaluate(env);
                results.push({ id: block.id, status: 'ok' });
            } catch (err) {
                results.push({ id: block.id, status: 'error', errorType: err.name || 'Error', message: err.message });
                break;   // B4: stop the program, don't run the remaining blocks
            }
        }
    }

    // #21: env -> UserFunction -> globalEnv -> env is a cycle. Sending it to
    // res.json() throws "Converting circular structure to JSON".
    const variables = Object.fromEntries(
        Object.entries(env).filter(([, value]) => !(value instanceof UserFunction))
    );

    return { variables, output, results };
}

module.exports = { runProgram, runBlocks: runProgram };