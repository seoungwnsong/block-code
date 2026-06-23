const { Assign, ParallelAssign, Print, If, ForRange, For, While, TaC } = require('./flowstatement');
const { BinaryOperator, Compare, Bool, BoolOp } = require('./operations');
const { num, Booleans, Strings } = require('./permitivedatatypes');

// Turns a block into an Expr node — works recursively for composed expressions
function toExpr(block) {
    if (typeof block === 'number') return new num(block);
    if (typeof block === 'string') {
        const trimmed = block.trim();
    
        if (trimmed === '') return new Strings('');
    
        if (trimmed === 'true') return new Booleans(true);
        if (trimmed === 'false') return new Booleans(false);
    
        const n = Number(trimmed);
        if (!isNaN(n)) return new num(n);
    
        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return new Strings(trimmed.slice(1, -1));
        }
    
        return {
            evaluate: (env) => {
                if (!(trimmed in env)) throw new Error(`Undefined variable: ${trimmed}`);
                return env[trimmed];
            }
        };
    }

    switch (block.type) {
        case 'int':    return new num(Number(block.value));
        case 'float':  return new num(Number(block.value));
        case 'str':
        case 'string':
            return new Strings(block.value);
        case 'bool':   return new Booleans(block.value === 'true' || block.value === true);

        case 'variable':
            // Read the variable's value from env at runtime
            return { evaluate: (env) => {
                if (!(block.name in env)) throw new Error(`Undefined variable: ${block.name}`);
                return env[block.name];
            }};

        case 'calculation':
            return new BinaryOperator(toExpr(block.left), block.operator, toExpr(block.right));
            
        case 'logic':
            if (block.operator === 'and' || block.operator === 'or') {
                return new BoolOp(block.operator, [toExpr(block.left), toExpr(block.right)]);
            }
        
            return new Compare(toExpr(block.left), [[block.operator, toExpr(block.right)]]);
            
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
            if (block.dataType === 'str' || block.dataType === 'string') return new Strings(String(block.value));
            if (block.dataType === 'bool') return new Booleans(block.value === 'true' || block.value === true);
            throw new Error(`Unknown expression block: "${block.type}"`);
    }
}

function conditionStringToExpr(condition) {
    if (typeof condition !== 'string') {
        return toExpr(condition);
    }

    const trimmed = condition.trim();
    const operators = ['==', '!=', '>=', '<=', '>', '<'];

    for (const operator of operators) {
        const index = trimmed.indexOf(operator);

        if (index !== -1) {
            const left = trimmed.slice(0, index).trim();
            const right = trimmed.slice(index + operator.length).trim();

            return new Compare(toExpr(left), [[operator, toExpr(right)]]);
        }
    }

    return toExpr(trimmed);
}

// Turns a block into a Statement node
function toStmt(block) {
    switch (block.type) {
        case 'variable':
            return new Assign(
                block.name,
                toExpr({ type: block.dataType, value: block.value })
            );

        case 'assign':
            return new Assign(block.name, toExpr(block.value));

        case 'parallelAssign':
            return new ParallelAssign(block.names, block.values.map(toExpr));

        case 'print':
            return new Print(toExpr(block.value));

        case 'if':
            return new If(
                conditionStringToExpr(block.condition),
                (block.children ?? []).map(toStmt),
                []
            );

        case 'while':
            return new While(
                conditionStringToExpr(block.condition),
                (block.children ?? []).map(toStmt)
            );

        case 'for':
            return new ForRange(
                block.variable,
                toExpr(block.start),
                toExpr(block.end),
                (block.children ?? []).map(toStmt)
            );

        case 'tryCatch':
            return new TaC(
                (block.tryChildren ?? []).map(toStmt),
                block.catchErrorName,
                (block.catchChildren ?? []).map(toStmt)
            );

        case 'calculation':
            return new Print(toExpr(block));

        case 'logic':
            return new Print(toExpr(block));

        default:
            throw new Error(`Unknown statement block: "${block.type}"`);
    }
}

function runBlocks(blocks) {
    const env = {};
    const output = [];
    const results = [];

    const originalLog = console.log;

    console.log = (...args) => {
        output.push(args.join(' '));
        originalLog(...args);
    };

    try {
        for (const block of blocks) {
            try {
                toStmt(block).evaluate(env);
                results.push({ id: block.id, status: 'ok' });
            } catch (err) {
                results.push({
                    id: block.id,
                    status: 'error',
                    message: err.message
                });

                return {
                    status: 'error',
                    variables: env,
                    output,
                    results,
                    error: err.message
                };
            }
        }

        return {
            status: 'success',
            variables: env,
            output,
            results,
            error: null
        };
    } finally {
        console.log = originalLog;
    }
}

module.exports = { runBlocks };
