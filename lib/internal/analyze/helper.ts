import type * as acorn from 'acorn';

export function createSequenceExpression(...parts: acorn.Expression[]): acorn.SequenceExpression {
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
        if (p.computed && p.property.type !== 'PrivateIdentifier') {
          expr.push(p.property);
          // don't push Identifier, this makes us get "foo.bar.zing" all together
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
