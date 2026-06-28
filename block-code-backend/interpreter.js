const { Assign, ParallelAssign, Print, If, ForRange, For, While, TaC } = require('./flowstatement');
const { BinaryOperator, Compare, Bool, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');

function toExpr(block) {
    if (block === null || block === undefined) {
        throw new Error(`Expression block is null or undefined`);
    }

    if (typeof block === 'number') return new num(block);

    if (typeof block === 'string') {
        // Has surrounding quotes → string literal
        if (block.startsWith("'") && block.endsWith("'")) {
            return new Strings(block.slice(1, -1));
        }
        // Pure number → numeric literal
        if (!isNaN(Number(block)) && block.trim() !== '') {
            return block.includes('.') ? new num(parseFloat(block)) : new num(parseInt(block, 10));
        }
        // Otherwise → variable lookup
        return { evaluate: (env) => {
            if (!(block in env)) throw new Error(`Undefined variable: ${block}`);
            return env[block];
        }};
    }

    switch (block.type) {
        case 'int':    return new num(parseInt(block.value, 10));
        case 'float':  return new num(parseFloat(block.value));
        case 'str':    return new Strings(String(block.value));
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

        default:
            if (block.dataType === 'int')   return new num(parseInt(block.value, 10));
            if (block.dataType === 'float') return new num(parseFloat(block.value));
            if (block.dataType === 'str')   return new Strings(String(block.value));
            if (block.dataType === 'bool')  return new Booleans(block.value === 'true' || block.value === true);
            throw new Error(`Unknown expression block type: "${block.type}"`);
    }
}

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
