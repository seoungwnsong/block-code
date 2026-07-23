// Regression suite for the frontend-integration fixes.
// Run with:  node test.js
// Exits non-zero if anything fails, so it can gate a commit.

const { runProgram } = require('./interpreter');
const { parse } = require('./parser');

let pass = 0, fail = 0;

const lit = (dataType, value) => ({ type: 'literal', dataType, value });
const ref = (name) => ({ type: 'variableReference', name });
const calc = (left, operator, right) => ({ type: 'calculation', left, operator, right });
const logic = (left, operator, right) => ({ type: 'logic', left, operator, right });
const call = (name, args = []) => ({ type: 'call', name, args });

function eq(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${msg}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
    }
}
function noErr(errs) {
    if (errs.length) throw new Error('unexpected errors: ' + JSON.stringify(errs));
}

function t(label, program, check) {
    let r;
    try {
        r = runProgram(program);
    } catch (e) {
        console.log(`FAIL  ${label} — runProgram threw: ${e.message}`);
        fail++;
        return;
    }
    const errs = r.results.filter(x => x.status === 'error');
    try {
        check(r, errs);
        console.log(`PASS  ${label}`);
        pass++;
    } catch (e) {
        console.log(`FAIL  ${label} — ${e.message}`);
        console.log('        ', JSON.stringify({ variables: r.variables, output: r.output, errs }));
        fail++;
    }
}

function raw(label, fn) {
    try {
        fn();
        console.log(`PASS  ${label}`);
        pass++;
    } catch (e) {
        console.log(`FAIL  ${label} — ${e.message}`);
        fail++;
    }
}

// ===========================================================================
// #1  runProgram accepts the whole request body
// ===========================================================================
t('#1  accepts { functions, blocks }',
  { functions: [], blocks: [{ id: 1, type: 'variable', name: 'x', value: lit('int', 3) }] },
  (r, e) => { noErr(e); eq(r.variables.x, 3, 'x'); });

t('#1  still accepts a bare array (back-compat)',
  [{ id: 1, type: 'variable', name: 'x', value: lit('int', 7) }],
  (r, e) => { noErr(e); eq(r.variables.x, 7, 'x'); });

// ===========================================================================
// #2 / #3 / #4  literals
// ===========================================================================
t('#2  variable value is a nested literal block',
  { blocks: [{ id: 1, type: 'variable', name: 'x', value: lit('int', 3) }] },
  (r, e) => { noErr(e); eq(r.variables.x, 3, 'x'); });

t('#3  bool and float literals',
  { blocks: [
      { id: 1, type: 'variable', name: 'b', value: lit('bool', true) },
      { id: 2, type: 'variable', name: 'f', value: lit('float', 2.5) }] },
  (r, e) => { noErr(e); eq(r.variables.b, true, 'b'); eq(r.variables.f, 2.5, 'f'); });

t('#4  dataType "string" (frontend spelling)',
  { blocks: [
      { id: 1, type: 'variable', name: 's', value: lit('string', 'hi') },
      { id: 2, type: 'print', value: ref('s') }] },
  (r, e) => { noErr(e); eq(r.output, ['hi'], 'output'); });

t('#4  dataType "str" still accepted (back-compat)',
  { blocks: [{ id: 1, type: 'variable', name: 's', value: lit('str', 'hi') }] },
  (r, e) => { noErr(e); eq(r.variables.s, 'hi', 's'); });

// ===========================================================================
// #5  variableReference
// ===========================================================================
t('#5  variableReference reads from env',
  { blocks: [
      { id: 1, type: 'variable', name: 'x', value: lit('int', 4) },
      { id: 2, type: 'variable', name: 'y', value: ref('x') }] },
  (r, e) => { noErr(e); eq(r.variables.y, 4, 'y'); });

t('#5  undefined variable is reported',
  { blocks: [{ id: 1, type: 'print', value: ref('nope') }] },
  (r, e) => { if (!e.length) throw new Error('expected an error'); });

// ===========================================================================
// #6  logic
// ===========================================================================
t('#6  logic as comparison',
  { blocks: [{ id: 1, type: 'variable', name: 'c', value: logic(lit('int', 2), '==', lit('int', 2)) }] },
  (r, e) => { noErr(e); eq(r.variables.c, true, 'c'); });

t('#6  logic as and/or',
  { blocks: [{ id: 1, type: 'variable', name: 'c', value: logic(lit('bool', true), 'and', lit('bool', false)) }] },
  (r, e) => { noErr(e); eq(r.variables.c, false, 'c'); });

// ===========================================================================
// #7 / #8  container field names
// ===========================================================================
t('#7  if reads children',
  { blocks: [
      { id: 1, type: 'variable', name: 'x', value: lit('int', 1) },
      { id: 2, type: 'if', condition: logic(ref('x'), '==', lit('int', 1)),
        children: [{ id: 3, type: 'print', value: lit('string', 'yes') }] }] },
  (r, e) => { noErr(e); eq(r.output, ['yes'], 'output'); });

t('#7  if reads body (back-compat)',
  { blocks: [
      { id: 1, type: 'if', condition: lit('bool', true),
        body: [{ id: 2, type: 'print', value: lit('string', 'old') }] }] },
  (r, e) => { noErr(e); eq(r.output, ['old'], 'output'); });

t('#8  while reads children',
  { blocks: [
      { id: 1, type: 'variable', name: 'i', value: lit('int', 0) },
      { id: 2, type: 'while', condition: logic(ref('i'), '<', lit('int', 3)),
        children: [{ id: 3, type: 'variable', name: 'i', value: calc(ref('i'), '+', lit('int', 1)) }] }] },
  (r, e) => { noErr(e); eq(r.variables.i, 3, 'i'); });

t('#8  while iteration cap fires',
  { blocks: [{ id: 1, type: 'while', condition: lit('bool', true), children: [] }] },
  (r, e) => { if (!e.length || !/iterations/.test(e[0].message)) throw new Error('expected cap error'); });

// ===========================================================================
// #9  for is a range loop
// ===========================================================================
t('#9  for maps to ForRange via start/end',
  { blocks: [
      { id: 1, type: 'variable', name: 'sum', value: lit('int', 0) },
      { id: 2, type: 'for', variable: 'i', start: lit('int', 0), end: lit('int', 4),
        children: [{ id: 3, type: 'variable', name: 'sum', value: calc(ref('sum'), '+', ref('i')) }] }] },
  (r, e) => { noErr(e); eq(r.variables.sum, 6, 'sum of 0..3'); });

// ===========================================================================
// #10  tryCatch
// ===========================================================================
t('#10  tryCatch field names',
  { blocks: [{ id: 1, type: 'tryCatch', catchErrorName: 'error',
      tryChildren: [{ id: 2, type: 'variable', name: 'z', value: calc(lit('int', 1), '/', lit('int', 0)) }],
      catchChildren: [{ id: 3, type: 'print', value: lit('string', 'caught') }] }] },
  (r, e) => { noErr(e); eq(r.output, ['caught'], 'output'); });

// ===========================================================================
// #11 / #12 / #13  user-defined functions
// ===========================================================================
t('#11/#12  def + call + return',
  { functions: [{ id: 99, type: 'def', name: 'add', params: ['a', 'b'],
      children: [{ id: 100, type: 'return', value: calc(ref('a'), '+', ref('b')) }] }],
    blocks: [{ id: 1, type: 'variable', name: 'r',
      value: { type: 'call', functionId: 99, name: 'add', paramNames: ['a', 'b'],
               args: [lit('int', 2), lit('int', 3)] } }] },
  (r, e) => { noErr(e); eq(r.variables.r, 5, 'r'); });

t('#12  arity mismatch is reported',
  { functions: [{ id: 99, type: 'def', name: 'add', params: ['a', 'b'], children: [] }],
    blocks: [{ id: 1, type: 'variable', name: 'r', value: call('add', [lit('int', 1)]) }] },
  (r, e) => { if (!e.length || !/expects 2 argument/.test(e[0].message)) throw new Error('expected arity error'); });

t('#13  mutual recursion (registration precedes execution)',
  { functions: [
      { id: 1, type: 'def', name: 'isEven', params: ['n'], children: [
          { id: 2, type: 'if', condition: logic(ref('n'), '==', lit('int', 0)),
            children: [{ id: 3, type: 'return', value: lit('bool', true) }] },
          { id: 4, type: 'return', value: call('isOdd', [calc(ref('n'), '-', lit('int', 1))]) }] },
      { id: 5, type: 'def', name: 'isOdd', params: ['n'], children: [
          { id: 6, type: 'if', condition: logic(ref('n'), '==', lit('int', 0)),
            children: [{ id: 7, type: 'return', value: lit('bool', false) }] },
          { id: 8, type: 'return', value: call('isEven', [calc(ref('n'), '-', lit('int', 1))]) }] }],
    blocks: [{ id: 9, type: 'variable', name: 'out', value: call('isEven', [lit('int', 6)]) }] },
  (r, e) => { noErr(e); eq(r.variables.out, true, 'isEven(6)'); });

// ===========================================================================
// #14  expression statements
// ===========================================================================
t('#14  standalone call runs for its side effect',
  { functions: [{ id: 99, type: 'def', name: 'shout', params: [],
      children: [{ id: 100, type: 'print', value: lit('string', 'side effect') }] }],
    blocks: [{ id: 1, type: 'call', name: 'shout', args: [] }] },
  (r, e) => { noErr(e); eq(r.output, ['side effect'], 'output'); });

t('#14  standalone calculation is legal',
  { blocks: [{ id: 1, type: 'calculation', left: lit('int', 1), operator: '+', right: lit('int', 2) }] },
  (r, e) => noErr(e));

// ===========================================================================
// #15  ReturnSignal survives try/catch
// ===========================================================================
t('#15  return inside try is not swallowed',
  { functions: [{ id: 99, type: 'def', name: 'f', params: [], children: [
      { id: 100, type: 'tryCatch', catchErrorName: 'err',
        tryChildren: [{ id: 101, type: 'return', value: lit('int', 5) }],
        catchChildren: [{ id: 102, type: 'return', value: lit('int', -1) }] },
      { id: 103, type: 'return', value: lit('int', 999) }] }],
    blocks: [{ id: 1, type: 'variable', name: 'v', value: call('f') }] },
  (r, e) => { noErr(e); eq(r.variables.v, 5, 'v (999 would mean the signal was swallowed)'); });

// ===========================================================================
// #16  console.log is never hijacked
// ===========================================================================
raw('#16  console.log survives a crashing run', () => {
    const before = console.log;
    try { runProgram({ blocks: [{ type: 'bogus' }] }); } catch (_) { /* ignore */ }
    if (console.log !== before) throw new Error('console.log left patched');
});

raw('#16  two runs do not share output', () => {
    const a = runProgram({ blocks: [{ id: 1, type: 'print', value: lit('string', 'A') }] });
    const b = runProgram({ blocks: [{ id: 1, type: 'print', value: lit('string', 'B') }] });
    eq(a.output, ['A'], 'run A');
    eq(b.output, ['B'], 'run B');
});

// ===========================================================================
// #18 / #19  parser-path correctness
// ===========================================================================
raw('#18  chained comparison is Python-style', () => {
    const env = Object.create(null);
    eq(parse('3 < 2 < 1').evaluate(env), false, '3 < 2 < 1');
    eq(parse('1 < 2 < 3').evaluate(env), true, '1 < 2 < 3');
});

raw('#19  and/or short-circuit', () => {
    const env = Object.create(null);
    eq(parse('false and 1 / 0').evaluate(env), false, 'and short-circuits');
    eq(parse('true or 1 / 0').evaluate(env), true, 'or short-circuits');
});

// ===========================================================================
// #20  prototype pollution
// ===========================================================================
t('#20  prototype keys are not defined variables',
  { blocks: [{ id: 1, type: 'print', value: ref('constructor') }] },
  (r, e) => { if (!e.length) throw new Error('"constructor" resolved as a variable'); });

raw('#20  parser rejects prototype keys too', () => {
    const env = Object.create(null);
    let threw = false;
    try { parse('toString').evaluate(env); } catch (_) { threw = true; }
    if (!threw) throw new Error('"toString" resolved as a variable');
});

// ===========================================================================
// #21  no circular JSON
// ===========================================================================
t('#21  result is JSON-serializable and functions are filtered out',
  { functions: [{ id: 99, type: 'def', name: 'f', params: [], children: [] }],
    blocks: [{ id: 1, type: 'variable', name: 'x', value: lit('int', 1) }] },
  (r) => {
      JSON.stringify(r);
      if ('f' in r.variables) throw new Error('UserFunction leaked into variables');
  });

// ===========================================================================
// A1  parser can call functions
// ===========================================================================
t('A1  free-form call with arguments',
  { functions: [{ id: 99, type: 'def', name: 'add', params: ['a', 'b'],
      children: [{ id: 100, type: 'return', value: calc(ref('a'), '+', ref('b')) }] }],
    blocks: [{ id: 1, type: 'variable', name: 'r', value: { type: 'expression', value: 'add(2, 3)' } }] },
  (r, e) => { noErr(e); eq(r.variables.r, 5, 'add(2, 3)'); });

t('A1  call inside a free-form condition',
  { functions: [{ id: 99, type: 'def', name: 'add', params: ['a', 'b'],
      children: [{ id: 100, type: 'return', value: calc(ref('a'), '+', ref('b')) }] }],
    blocks: [
      { id: 1, type: 'if', condition: 'add(2, 3) > 4',
        children: [{ id: 2, type: 'print', value: lit('string', 'bigger') }] }] },
  (r, e) => { noErr(e); eq(r.output, ['bigger'], 'output'); });

t('A1  zero-argument call',
  { functions: [{ id: 99, type: 'def', name: 'five', params: [],
      children: [{ id: 100, type: 'return', value: lit('int', 5) }] }],
    blocks: [{ id: 1, type: 'variable', name: 'r', value: { type: 'expression', value: 'five()' } }] },
  (r, e) => { noErr(e); eq(r.variables.r, 5, 'five()'); });

t('A1  nested and recursive calls in a free-form string',
  { functions: [{ id: 99, type: 'def', name: 'fact', params: ['n'], children: [
      { id: 100, type: 'if', condition: logic(ref('n'), '<=', lit('int', 1)),
        children: [{ id: 101, type: 'return', value: lit('int', 1) }] },
      { id: 102, type: 'return', value: 'n * fact(n - 1)' }] }],
    blocks: [{ id: 1, type: 'variable', name: 'r', value: { type: 'expression', value: 'fact(5) + fact(3)' } }] },
  (r, e) => { noErr(e); eq(r.variables.r, 126, '120 + 6'); });

raw('A1  call to an unknown function reports clearly', () => {
    const env = Object.create(null);
    let msg = '';
    try { parse('nope(1)').evaluate(env); } catch (e) { msg = e.message; }
    if (!/Undefined function/.test(msg)) throw new Error(`unclear message: ${msg}`);
});

raw('A1  parentheses still group expressions', () => {
    const env = Object.create(null);
    eq(parse('(2 + 3) * 4').evaluate(env), 20, 'grouping');
});

// ===========================================================================
// A2  modulo by zero
// ===========================================================================
t('A2  modulo by zero throws instead of yielding NaN',
  { blocks: [{ id: 1, type: 'variable', name: 'x', value: calc(lit('int', 5), '%', lit('int', 0)) }] },
  (r, e) => { if (!e.length || !/Modulo by zero/.test(e[0].message)) throw new Error('expected Modulo by zero'); });

t('A2  normal modulo still works',
  { blocks: [{ id: 1, type: 'variable', name: 'x', value: calc(lit('int', 7), '%', lit('int', 3)) }] },
  (r, e) => { noErr(e); eq(r.variables.x, 1, '7 % 3'); });

// ===========================================================================
// A3  catch variable is displayable
// ===========================================================================
t('A3  catch variable holds a readable message, not {}',
  { blocks: [{ id: 1, type: 'tryCatch', catchErrorName: 'error',
      tryChildren: [{ id: 2, type: 'variable', name: 'z', value: calc(lit('int', 1), '/', lit('int', 0)) }],
      catchChildren: [{ id: 3, type: 'print', value: ref('error') }] }] },
  (r, e) => {
      noErr(e);
      eq(r.output, ['Division by zero'], 'printed message');
      eq(r.variables.error, 'Division by zero', 'bound value');
      eq(JSON.parse(JSON.stringify(r.variables)).error, 'Division by zero', 'survives JSON');
  });

// ===========================================================================
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
