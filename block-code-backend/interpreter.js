const { Assign, ParallelAssign, Print, If, ForRange, For, While, TaC } = require('./flowstatement');
const { BinaryOperator, Compare, Bool, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');
const { FunctionDef, Return, Call } = require('./functions'); // NEW: pull in the function-specific classes

function toExpr(block) {
    if (typeof block === 'number') return new num(block);
    if (typeof block === 'string') {
        const n = Number(block);
        return isNaN(n) ? new Strings(block) : new num(n);
    }

    switch (block.type) {
        case 'int':    return new num(Number(block.value));
        case 'float':  return new num(Number(block.value));
        case 'str':    return new Strings(block.value);
        case 'bool':   return new Booleans(block.value === 'true' || block.value === true);

        case 'variable':
            return { evaluate: (env) => {
                if (!(block.name in env)) throw new Error(`Undefined variable: ${block.name}`);
                return env[block.name];
            }};

        case 'calculation':
            return new BinaryOperator(toExpr(block.left), block.operator, toExpr(block.right));

        case 'compare':
            return block.comparisons
                ? new Compare(toExpr(block.left), block.comparisons.map(c => [c.op, toExpr(c.right)]))
                : new Compare(toExpr(block.left), [[block.operator, toExpr(block.right)]]);

        case 'boolop':
            return new BoolOp(block.operator, block.values.map(toExpr));

        // NEW: a call used as an expression, e.g. the value of result = add(2, 3)
        case 'call':
            return new Call(block.name, (block.args ?? []).map(toExpr));

        default:
            if (block.dataType === 'int' || block.dataType === 'float') return new num(Number(block.value));
            if (block.dataType === 'str')  return new Strings(String(block.value));
            if (block.dataType === 'bool') return new Booleans(block.value === 'true' || block.value === true);
            throw new Error(`Unknown expression block: "${block.type}"`);
    }
}

function toStmt(block) {
    switch (block.type) {
        case 'variable':       return new Assign(block.name, toExpr({ type: block.dataType, value: block.value }));
        case 'assign':         return new Assign(block.name, toExpr(block.value));
        case 'parallelAssign': return new ParallelAssign(block.names, block.values.map(toExpr));
        case 'print':          return new Print(toExpr(block.value));
        case 'if':             return new If(toExpr(block.condition), block.body.map(toStmt), (block.elseBody ?? []).map(toStmt));
        case 'forRange':       return new ForRange(block.variable, toExpr(block.start), toExpr(block.stop), block.body.map(toStmt));
        case 'for':            return new For(block.variable, toExpr(block.iterable), block.body.map(toStmt));
        case 'while':          return new While(toExpr(block.condition), block.body.map(toStmt));
        case 'tac':            return new TaC(block.body.map(toStmt), block.error, block.handler.map(toStmt));

        // NEW: define a function — registers it in env when evaluated
        case 'def':            return new FunctionDef(block.name, block.params ?? [], (block.body ?? []).map(toStmt));
        // NEW: return statement — only meaningful inside a function body
        case 'return':         return new Return(block.value != null ? toExpr(block.value) : null);
        // NEW: a call used as a standalone statement (run for side effects; return value ignored)
        case 'call':           return new Call(block.name, (block.args ?? []).map(toExpr));

        default:               throw new Error(`Unknown statement block: "${block.type}"`);
    }
}

function runBlocks(blocks) {
    const env = {};
    const output = [];
    const results = [];

    const originalLog = console.log;
    console.log = (...args) => { output.push(args.join(' ')); originalLog(...args); };

    for (const block of blocks) {
        try {
            toStmt(block).evaluate(env);
            results.push({ id: block.id, status: 'ok' });
        } catch (err) {
            results.push({ id: block.id, status: 'error', message: err.message });
        }
    }

    console.log = originalLog;

    // NEW: function objects live in env like any value; skip them when building
    // the variables response so the frontend doesn't receive UserFunction objects
    const variables = {};
    for (const key of Object.keys(env)) {
        const value = env[key];
        if (value && value.isUserFunction) continue;
        variables[key] = value;
    }

    return { variables, output, results };
}

module.exports = { runBlocks };
