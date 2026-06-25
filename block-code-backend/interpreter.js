const { Assign, ParallelAssign, Print, If, ForRange, For, While, TaC } = require('./flowstatement');
const { BinaryOperator, Compare, Bool, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');

// Turns a block into an Expr node — works recursively for composed expressions
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
        default:             throw new Error(`Unknown statement block: "${block.type}"`);
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
    return { variables: env, output, results };
}

module.exports = { runBlocks };