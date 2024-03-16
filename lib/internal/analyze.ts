import * as acorn from 'acorn';

/**
 * Returns the following statements inside an immediately-invoked function expression.
 */
function createIife(body: acorn.Statement[]): acorn.CallExpression {
  return {
    type: 'CallExpression',
    arguments: [],
    callee: {
      type: 'FunctionExpression',
      body: {
        type: 'BlockStatement',
        body,
        start: -1,
        end: -1,
      },
      start: -1,
      end: -1,
      params: [],
      async: false,
      expression: true,
      generator: false,
      // nb. this does NOT have an id; having an id makes this callable again
    },
    start: -1,
    end: -1,
    optional: false,
  };
}

function createSequenceExpression(...parts: acorn.Expression[]): acorn.SequenceExpression {
  return {
    type: 'SequenceExpression',
    start: -1,
    end: -1,
    expressions: parts,
  };
}

export function createBlock(...body: acorn.Statement[]): acorn.BlockStatement {
  return {
    type: 'BlockStatement',
    start: -1,
    end: -1,
    body,
  };
}

export function createExpressionStatement(...body: acorn.Expression[]): acorn.ExpressionStatement {
  return {
    type: 'ExpressionStatement',
    start: -1,
    end: -1,
    expression: body.length === 1 ? body[0] : createSequenceExpression(...body),
  };
}

export function processPattern(p: acorn.Pattern) {
  const names: string[] = [];
  const expr: acorn.Expression[] = [];
  const pending = [p];

  while (pending.length) {
    const p = pending.shift()!;
    switch (p.type) {
      case 'Identifier':
        names.push(p.name);
        continue;

      case 'RestElement':
        pending.push(p.argument);
        continue;

      case 'ArrayPattern':
        for (const e of p.elements) {
          e && pending.push(e);
        }
        continue;

      case 'AssignmentPattern':
        pending.push(p.left);
        expr.push(p.right);
        continue;

      case 'ObjectPattern':
        for (const prop of p.properties) {
          if (prop.type !== 'Property') {
            pending.push(prop);
            continue;
          }

          prop.computed && expr.push(prop.key);
          pending.push(prop.value);
        }
        continue;

      case 'MemberExpression':
        if (p.object.type !== 'Super') {
          expr.push(p.object);
        }
        if (p.property.type !== 'PrivateIdentifier') {
          expr.push(p.property);
        }
        continue;
    }

    throw `should not get here`;
  }

  const init = expr.slice();

  for (const name of names) {
    expr.push({
      type: 'Identifier',
      start: -1,
      end: -1,
      name: name,
    });
  }

  return {
    names,
    expression: createSequenceExpression(...expr),
    init: init.length ? createSequenceExpression(...init) : undefined,
  };
}

function reductifyClassParts(c: acorn.Class): acorn.Expression {
  const e: acorn.Expression[] = [];
  c.superClass && e.push(c.superClass);

  for (const part of c.body.body) {
    switch (part.type) {
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (part.computed) {
          e.push(part.key as acorn.Expression);
        }
        if (part.value) {
          if (part.static || part.type === 'MethodDefinition') {
            // evaluated here
            e.push(part.value);
          } else {
            // not run immediately but can ref
            const expr: acorn.ReturnStatement = {
              type: 'ReturnStatement',
              start: -1,
              end: -1,
              argument: part.value,
            };
            e.push(createIife([expr]));
          }
        }
        break;

      case 'StaticBlock':
        // push self-evaluated function expr
        e.push(createIife(part.body));
        break;
    }
  }

  return e.length === 1 ? e[0] : createSequenceExpression(...e);
}

function reductifyFunction(f: acorn.Function): acorn.BlockStatement {
  const body: acorn.Statement[] = [];

  if (f.params.length) {
    const decl: acorn.VariableDeclaration = {
      type: 'VariableDeclaration',
      start: -1,
      end: -1,
      kind: 'var',
      declarations: f.params.map((id): acorn.VariableDeclarator => {
        return {
          type: 'VariableDeclarator',
          start: id.start,
          end: id.end,
          id,
        };
      }),
    };
    body.push(decl);
  } else if (f.body.type === 'BlockStatement') {
    return f.body;
  }

  body.push(f.body.type === 'BlockStatement' ? f.body : createExpressionStatement(f.body));
  return createBlock(...body);
}

function reductifyStatement(
  b: acorn.Statement,
): acorn.BlockStatement | acorn.Expression | acorn.VariableDeclaration | void {
  switch (b.type) {
    case 'LabeledStatement':
      return reductifyStatement(b.body);

    case 'EmptyStatement':
    case 'ContinueStatement':
    case 'BreakStatement':
    case 'DebuggerStatement':
      return undefined;

    case 'BlockStatement':
      return b;

    case 'ExpressionStatement':
      return b.expression;

    case 'ReturnStatement':
    case 'ThrowStatement':
      return b.argument ?? undefined;

    case 'VariableDeclaration':
      return b;

    case 'FunctionDeclaration': {
      // pretend to be "let foo = function foo() { ... }"
      const decl: acorn.VariableDeclarator = {
        type: 'VariableDeclarator',
        start: -1,
        end: -1,
        id: b.id,
        init: {
          type: 'FunctionExpression',
          start: -1,
          end: -1,
          async: b.async,
          generator: b.generator,
          params: b.params,
          expression: true, // not really but fine
          id: b.id,
          body: b.body,
        },
      };
      return {
        type: 'VariableDeclaration',
        start: -1,
        end: -1,
        kind: 'let',
        declarations: [decl],
      };
    }

    case 'ClassDeclaration': {
      // pretend to be "const Foo = class Foo { ... }"
      const decl: acorn.VariableDeclarator = {
        type: 'VariableDeclarator',
        start: -1,
        end: -1,
        id: b.id,
        init: {
          type: 'ClassExpression',
          start: -1,
          end: -1,
          id: b.id,
          superClass: b.superClass,
          body: b.body,
        },
      };
      return {
        type: 'VariableDeclaration',
        start: -1,
        end: -1,
        kind: 'const',
        declarations: [decl],
      };
    }

    case 'IfStatement': {
      const body: acorn.Statement[] = [createExpressionStatement(b.test), b.consequent];
      b.alternate && body.push(b.alternate);
      return createBlock(...body);
    }

    case 'WhileStatement':
      return createBlock(createExpressionStatement(b.test), b.body);

    case 'DoWhileStatement':
      return createBlock(b.body, createExpressionStatement(b.test));

    case 'SwitchStatement': {
      const body: acorn.Statement[] = [createExpressionStatement(b.discriminant)];
      for (const c of b.cases) {
        c.test && body.push(createExpressionStatement(c.test));
        body.push(...c.consequent);
      }
      return createBlock(...body);
    }

    case 'ForStatement': {
      const body: acorn.Statement[] = [];

      if (b.init?.type === 'VariableDeclaration') {
        body.push(b.init);
      } else if (b.init) {
        body.push(createExpressionStatement(b.init));
      }
      b.test && body.push(createExpressionStatement(b.test));
      b.update && body.push(createExpressionStatement(b.update));
      body.push(b.body);

      return createBlock(...body);
    }

    case 'ForInStatement':
    case 'ForOfStatement': {
      const body: acorn.Statement[] = [];

      if (b.left.type === 'VariableDeclaration') {
        body.push(b.left);
      } else {
        const { expression } = processPattern(b.left);
        body.push(createExpressionStatement(expression));
      }

      body.push(createExpressionStatement(b.right));
      body.push(b.body);

      return createBlock(...body);
    }

    case 'TryStatement': {
      const rest: acorn.Statement[] = [];

      if (b.handler) {
        if (b.handler.param) {
          // "catch (foo)" => something like "let foo"
          const decl: acorn.VariableDeclaration = {
            type: 'VariableDeclaration',
            start: -1,
            end: -1,
            declarations: [
              {
                type: 'VariableDeclarator',
                start: -1,
                end: -1,
                id: b.handler.param,
              },
            ],
            kind: 'let',
          };
          rest.push(createBlock(decl, b.handler.body));
        } else {
          rest.push(b.handler.body);
        }
      }
      b.finalizer && rest.push(b.finalizer);

      return createBlock(b.block, ...rest);
    }

    default:
      throw new Error(`unsupported: ${b.type}`);
  }
}

export type VarInfo = {
  written: boolean;
  nestedWrite: boolean;
  kind?: 'let' | 'var' | 'const';

  /**
   * This is `false` if the value is rewritten many times or inside a nested block.
   */
  simple: boolean;
};

export type AnalyzeBlock = {
  vars: Map<string, VarInfo>;
};

export function analyzeBlock(b: acorn.BlockStatement): AnalyzeBlock {
  const out: AnalyzeBlock = { vars: new Map() };

  const markIdentifier = (name: string, written: boolean = false) => {
    const prev = out.vars.get(name);
    if (prev) {
      prev.written ||= written;
      if (written) {
        prev.simple = false;
      }
      return prev;
    }
    const info: VarInfo = { written, nestedWrite: false, kind: undefined, simple: true };
    out.vars.set(name, info);
    return info;
  };

  const processExpression = (
    e: acorn.Expression | acorn.Super | acorn.PrivateIdentifier | acorn.SpreadElement,
  ): void => {
    switch (e.type) {
      case 'PrivateIdentifier':
      case 'Super':
      case 'Literal':
      case 'ThisExpression':
      case 'MetaProperty':
        break;

      case 'ChainExpression':
      case 'ParenthesizedExpression':
        processExpression(e.expression);
        break;

      case 'SpreadElement':
      case 'YieldExpression':
      case 'AwaitExpression':
      case 'UnaryExpression':
        e.argument && processExpression(e.argument);
        break;

      case 'Identifier':
        markIdentifier(e.name);
        break;

      case 'AssignmentExpression': {
        const p = processPattern(e.left);
        p.names.forEach((name) => markIdentifier(name, true));
        processExpression(e.right);
        break;
      }

      case 'UpdateExpression': {
        if (e.argument.type === 'Identifier') {
          // nb. acorn unwraps "((foo))++" for us, so this is probably safe
          markIdentifier(e.argument.name, true);
        } else {
          processExpression(e.argument);
        }
        break;
      }

      case 'NewExpression':
      case 'CallExpression':
        e.arguments.forEach((arg) => processExpression(arg));

        if (
          e.callee.type === 'ArrowFunctionExpression' ||
          (e.callee.type === 'FunctionExpression' && !e.callee.id)
        ) {
          // this is an IIFE, 'run' immediately
          const block = reductifyFunction(e.callee);
          const inner = analyzeBlock(block);
          for (const [key, info] of inner.vars) {
            if (info.kind) {
              continue;
            }
            const vi = markIdentifier(key, info.written);
            vi.nestedWrite ||= info.nestedWrite;
          }
        } else {
          // normal function - can be called whenever
          processExpression(e.callee);
        }

        break;

      case 'TemplateLiteral':
      case 'SequenceExpression':
        e.expressions.forEach((arg) => processExpression(arg));
        break;

      case 'ArrayExpression':
        e.elements.forEach((el) => el && processExpression(el));
        break;

      case 'ConditionalExpression':
        processExpression(e.test);
        processExpression(e.consequent);
        processExpression(e.alternate);
        break;

      case 'BinaryExpression':
      case 'LogicalExpression':
        processExpression(e.left);
        processExpression(e.right);
        break;

      case 'ClassExpression':
        processExpression(reductifyClassParts(e));
        break;

      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const block = reductifyFunction(e);
        const inner = analyzeBlock(block);

        for (const [key, info] of inner.vars) {
          if (info.kind) {
            continue;
          }

          const prev = out.vars.get(key);
          const nestedWrite = info.written || info.nestedWrite;
          if (prev) {
            prev.nestedWrite ||= nestedWrite;
            if (nestedWrite) {
              prev.simple = false;
            }
          } else {
            out.vars.set(key, {
              nestedWrite,
              written: false,
              kind: undefined,
              simple: !nestedWrite,
            });
          }
        }
        break;
      }

      case 'TaggedTemplateExpression':
        processExpression(e.tag);
        processExpression(e.quasi);
        break;

      case 'MemberExpression':
        processExpression(e.object);
        e.computed && processExpression(e.property);
        break;

      case 'ObjectExpression': {
        for (const prop of e.properties) {
          if (prop.type === 'SpreadElement') {
            processExpression(prop.argument);
          } else {
            prop.computed && processExpression(prop.key);
            processExpression(prop.value);
          }
        }
        break;
      }

      case 'ImportExpression':
        processExpression(e.source);
        break;

      default:
        throw new Error(`should not get here: ${(e as any).type}`);
    }
  };

  for (const raw of b.body) {
    let simple = reductifyStatement(raw);
    if (!simple) {
      continue;
    } else if (simple.type === 'BlockStatement') {
      const inner = analyzeBlock(simple);

      for (const [key, info] of inner.vars) {
        const prev = out.vars.get(key);
        if (prev === undefined) {
          if (info.kind === 'var' || !info.kind) {
            out.vars.set(key, info);
          }
          continue;
        }

        if (info.kind === undefined) {
          // treat as 'use' only
          prev.written ||= info.written;
          prev.nestedWrite ||= info.nestedWrite;
          continue;
        } else if (info.kind !== 'var') {
          continue; // ignore, was 'let'/'const' in inner block
        }

        // hoist 'var'
        if (prev.kind && prev.kind !== 'var') {
          // this is var overlaying var
          throw new Error(`got kind mismatch: inner 'var' found outer '${prev.kind}'`);
        }
        prev.kind = 'var';
        prev.written ||= info.written;
        prev.nestedWrite ||= info.nestedWrite;
      }
      continue;
    } else if (simple.type === 'VariableDeclaration') {
      // apply here
      const expressions: acorn.Expression[] = [];

      for (const declaration of simple.declarations) {
        const p = processPattern(declaration.id);
        p.init && expressions.push(p.init);
        declaration.init && expressions.push(declaration.init);

        // can be false in let/var without initializer
        const written = Boolean(p.init || declaration.init);

        for (const name of p.names) {
          const prev = out.vars.get(name);
          if (prev) {
            if (prev.kind && (simple.kind !== 'var' || prev.kind !== 'var')) {
              throw new Error(
                `got kind mismatch: can only redeclare 'var', was '${prev.kind}' got '${simple.kind}'`,
              );
            }
            prev.kind ||= simple.kind;
            prev.written ||= written;
            prev.simple = false;
            continue;
          }
          out.vars.set(name, { written, nestedWrite: false, kind: simple.kind, simple: true });
        }
      }

      // create expression out of output
      if (!expressions.length) {
        continue;
      }
      simple = createSequenceExpression(...expressions);
    }

    // we're an expr
    processExpression(simple);
  }

  return out;
}
