import type * as acorn from 'acorn';
import { analyzeBlock } from './block.ts';
import {
  createBlock,
  createExpressionStatement,
  createSequenceExpression,
  processPattern,
} from './helper.ts';

export type MarkIdentifierFn = (
  name: string,
  arg: { nested: boolean; writes: number } | { special: { await?: boolean; nested?: boolean } },
) => void;

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

export function patternsToDeclaration(...p: acorn.Pattern[]): acorn.VariableDeclaration {
  const decl: acorn.VariableDeclaration = {
    type: 'VariableDeclaration',
    start: -1,
    end: -1,
    kind: 'var',
    declarations: p.map((id): acorn.VariableDeclarator => {
      return {
        type: 'VariableDeclarator',
        start: id.start,
        end: id.end,
        id,
      };
    }),
  };
  return decl;
}

export function namesFromDeclaration(d: acorn.VariableDeclaration) {}

/**
 * Returns the given "class" as a number of simple component parts.
 * This can't be used or run but is the same from an analysis point of view.
 */
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
        if (!part.value) {
          break;
        }
        if (part.static || part.type === 'MethodDefinition') {
          // evaluated here
          e.push(part.value);
          break;
        }
        // otherwise pretend to be a method, not "called" immediately
        e.push({
          type: 'ArrowFunctionExpression',
          start: -1,
          end: -1,
          body: part.value,
          params: [],
          generator: false,
          async: false,
          expression: true,
        });
        break;

      case 'StaticBlock':
        // push self-evaluated function expr
        e.push(createIife(part.body));
        break;
    }
  }

  return e.length === 1 ? e[0] : createSequenceExpression(...e);
}

export function reductifyFunction(f: acorn.Function): acorn.BlockStatement {
  const body: acorn.Statement[] = [];

  // our own function name becomes something we can reference
  if (f.id?.name && f.id.name !== 'default') {
    const decl: acorn.VariableDeclaration = {
      type: 'VariableDeclaration',
      start: -1,
      end: -1,
      kind: 'var',
      declarations: [
        {
          type: 'VariableDeclarator',
          start: f.id.start,
          end: f.id.end,
          id: f.id,
        },
      ],
    };
    body.push(decl);
  }

  if (f.params.length) {
    body.push(patternsToDeclaration(...f.params));
  } else if (f.body.type === 'BlockStatement') {
    return f.body;
  }

  body.push(f.body.type === 'BlockStatement' ? f.body : createExpressionStatement(f.body));
  return createBlock(...body);
}

export function processExpression(
  e: acorn.Expression | acorn.Super | acorn.PrivateIdentifier | acorn.SpreadElement,
  mark: MarkIdentifierFn,
): void {
  switch (e.type) {
    case 'PrivateIdentifier':
    case 'Super':
    case 'Literal':
    case 'ThisExpression':
    case 'MetaProperty':
      break;

    case 'ChainExpression':
    case 'ParenthesizedExpression':
      processExpression(e.expression, mark);
      break;

    case 'AwaitExpression':
      mark('', { special: { await: true } });
      processExpression(e.argument, mark);
      break;

    case 'SpreadElement':
    case 'YieldExpression':
    case 'UnaryExpression':
      e.argument && processExpression(e.argument, mark);
      break;

    case 'Identifier':
      mark(e.name, { nested: false, writes: 0 });
      break;

    case 'AssignmentExpression': {
      const p = processPattern(e.left);
      p.names.forEach((name) => mark(name, { nested: false, writes: 1 }));
      p.init && processExpression(p.init, mark);
      processExpression(e.right, mark);
      break;
    }

    case 'UpdateExpression': {
      if (e.argument.type === 'Identifier') {
        // nb. acorn unwraps "((foo))++" for us, so this is probably safe
        mark(e.argument.name, { nested: false, writes: 1 });
      } else {
        processExpression(e.argument, mark);
      }
      break;
    }

    case 'ImportExpression':
      // we basically use the global 'import', even though this is a keyword
      mark('import', { nested: false, writes: 0 });
      processExpression(e.source, mark);
      break;

    case 'NewExpression':
    case 'CallExpression':
      e.arguments.forEach((arg) => processExpression(arg, mark));
      if (
        !(e.callee.type === 'ArrowFunctionExpression' || e.callee.type === 'FunctionExpression')
      ) {
        processExpression(e.callee, mark);
        break;
      }

      // this is an IIFE, 'run' immediately and pretend access isn't nested
      const block = reductifyFunction(e.callee);
      const inner = analyzeBlock(block);
      for (const [key, info] of inner.vars) {
        if (!info?.local?.kind) {
          const writes = (info.local?.writes ?? 0) + (info.nested?.writes ?? 0);
          mark(key, { nested: false, writes });
        }
      }
      break;

    case 'TemplateLiteral':
    case 'SequenceExpression':
      e.expressions.forEach((arg) => processExpression(arg, mark));
      break;

    case 'ArrayExpression':
      e.elements.forEach((el) => el && processExpression(el, mark));
      break;

    case 'ConditionalExpression':
      processExpression(e.test, mark);
      processExpression(e.consequent, mark);
      processExpression(e.alternate, mark);
      break;

    case 'BinaryExpression':
    case 'LogicalExpression':
      processExpression(e.left, mark);
      processExpression(e.right, mark);
      break;

    case 'ClassExpression':
      mark('', { special: { nested: true } });
      processExpression(reductifyClassParts(e), mark);
      break;

    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      mark('', { special: { nested: true } });

      const block = reductifyFunction(e);
      const inner = analyzeBlock(block);

      for (const [key, info] of inner.vars) {
        if (!info?.local?.kind) {
          const writes = (info.local?.writes ?? 0) + (info.nested?.writes ?? 0);
          mark(key, { nested: true, writes });
        }
      }
      break;
    }

    case 'TaggedTemplateExpression':
      processExpression(e.tag, mark);
      processExpression(e.quasi, mark);
      break;

    case 'MemberExpression':
      processExpression(e.object, mark);
      e.computed && processExpression(e.property, mark);
      break;

    case 'ObjectExpression': {
      for (const prop of e.properties) {
        if (prop.type === 'SpreadElement') {
          processExpression(prop.argument, mark);
        } else {
          prop.computed && processExpression(prop.key, mark);
          processExpression(prop.value, mark);
        }
      }
      break;
    }

    default:
      throw new Error(`should not get here: ${(e as any).type}`);
  }
}
