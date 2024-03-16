import type * as acorn from 'acorn';
import { processPattern } from './analyze.ts';

export type ExportKind = 'reexport' | 'immutable' | 'livebind';

export type AggregateImports = {
  imports: Map<string, { localAny?: boolean; reexportAny?: boolean }>;
  localRefImports: Map<string, { remote: string; import: string }>;
  exports: Map<string, { name: string; import?: string; const?: boolean }>;
  localMaybeChange: Set<string>;
  rest: acorn.Statement[];
};

const fakeDefaultIdentifier: acorn.Identifier = Object.freeze({
  start: -1,
  end: -1,
  type: 'Identifier',
  name: 'default',
});

const buildFakeDefaultConst = (expr: acorn.Expression): acorn.VariableDeclaration => {
  const decl: acorn.VariableDeclarator = {
    start: -1,
    end: -1,
    type: 'VariableDeclarator',
    id: {
      start: -1,
      end: -1,
      type: 'Identifier',
      name: 'default',
    },
    init: expr,
  };
  return {
    start: -1,
    end: -1,
    type: 'VariableDeclaration',
    declarations: [decl],
    kind: 'const',
  };
};

function nodeToString(source: acorn.Literal | acorn.Identifier | string): string {
  if (typeof source === 'string') {
    return source;
  }

  if (source.type === 'Identifier') {
    return source.name;
  }

  if (typeof source.value === 'string') {
    return source.value;
  }

  throw new Error(`importing non-string?`);
}

export function aggregateImports(p: acorn.Program): AggregateImports {
  const out: AggregateImports = {
    imports: new Map(),
    localRefImports: new Map(),
    exports: new Map(),
    localMaybeChange: new Set(),
    rest: [],
  };

  const topLevelConst = new Set<string>();

  const addImport = (importValue: string, localAny: boolean = false) => {
    let curr = out.imports.get(importValue);
    if (!curr) {
      curr = {};
      out.imports.set(importValue, curr);
    }
    return curr;
  };

  // 1st pass: imports

  for (const node of p.body) {
    if (node.type !== 'ImportDeclaration') {
      continue;
    }

    let localAny = false;
    const importValue = node.source.value as string;

    for (const s of node.specifiers) {
      const local = s.local.name;
      let remote: acorn.Literal | acorn.Identifier | string | undefined;

      switch (s.type) {
        case 'ImportNamespaceSpecifier':
          remote = '';
          break;
        case 'ImportDefaultSpecifier':
          remote = 'default';
          break;
        case 'ImportSpecifier':
          remote = s.imported;
          break;
      }

      if (remote !== undefined) {
        out.localRefImports.set(local, { remote: nodeToString(remote), import: importValue });
        localAny = true;
      }
    }
    const o = addImport(importValue);
    if (localAny) {
      o.localAny = true;
    }
  }

  // 2nd pass: exports and remaining statements

  for (const node of p.body) {
    switch (node.type) {
      case 'VariableDeclaration': {
        if (node.kind !== 'const') {
          continue;
        }

        // store top-level const in case it's exported as something else
        for (const s of node.declarations) {
          const p = processPattern(s.id);
          p.names.forEach((name) => topLevelConst.add(name));
        }
        continue;
      }

      case 'ExportAllDeclaration': {
        // this is a re-export of all
        const o = addImport(node.source.value as string);
        o.reexportAny = true;
        continue;
      }

      case 'ExportNamedDeclaration': {
        let importPart: undefined | { import: string } = undefined;

        if (node.source) {
          // this is a direct re-export rather than being used here
          // add the source file as an import
          importPart = { import: node.source.value as string };
          const o = addImport(importPart.import);
          o.reexportAny = true;
        }

        if (!node.declaration) {
          for (const s of node.specifiers) {
            const name = nodeToString(s.local);
            const exported = nodeToString(s.exported);

            out.exports.set(exported, { name, ...importPart });
          }
          continue;
        } else if (node.declaration.type === 'VariableDeclaration') {
          const constPart = node.declaration.kind === 'const' ? { const: true } : undefined;

          const accumulate = (name: string) => {
            out.exports.set(name, { name, ...constPart });
            topLevelConst.add(name);
          };
          for (const s of node.declaration.declarations) {
            const p = processPattern(s.id);
            p.names.forEach(accumulate);
          }

          out.rest.push(node.declaration);
          break;
        }
      } // fall-through

      case 'ExportDefaultDeclaration':
        const d = node.declaration!;
        const isDefault = node.type === 'ExportDefaultDeclaration';

        switch (d.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration':
            if (d.id && isDefault) {
              // e.g., "export default class foo {}; foo = 123;"
              out.exports.set('default', { name: d.id.name });
            } else if (d.id) {
              // normal
              out.exports.set(d.id.name, { name: d.id.name });
            } else if (isDefault) {
              // can't reassign unnamed declaration
              out.exports.set('default', { name: 'default', const: true });
            } else {
              throw new Error(`unnamed declaration`);
            }

            out.rest.push({ ...d, id: d.id || fakeDefaultIdentifier });
            break;

          case 'VariableDeclaration':
            throw new Error(`TS confused`);

          default: // default is an expr, so evaluated immediately: always const
            out.exports.set('default', { name: 'default', const: true });
            out.rest.push(buildFakeDefaultConst(d));
            break;
        }
        continue;

      case 'ImportDeclaration': // skip, already processed above
        continue;

      default: // boring expr
        out.rest.push(node);
        continue;
    }
  }

  // 3rd pass(ish): reconcile
  for (const d of out.exports.values()) {
    if (d.import || d.const) {
      continue;
    }
    const asImport = out.localRefImports.get(d.name);
    if (asImport) {
      d.import = asImport.import;
      d.name = asImport.remote;
      continue;
    }
    if (topLevelConst.has(d.name)) {
      d.const = true;
      continue;
    }
    out.localMaybeChange.add(d.name);
  }

  return out;
}
