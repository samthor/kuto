import type * as acorn from 'acorn';
import { processPattern } from './analyze.ts';
import { ModDef } from './moddef.ts';

export type AggregateImports = {
  mod: ModDef;
  localConst: Set<string>;
  declarationExports: Map<string, acorn.ExportNamedDeclaration | acorn.ExportDefaultDeclaration>;
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
    mod: new ModDef(),
    localConst: new Set(),
    declarationExports: new Map(),
    rest: [],
  };

  // early pass: ordering

  for (const node of p.body) {
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration':
        if (node.source) {
          const importSource = node.source.value as string;
          out.mod.addSource(importSource);
        }
        continue;
    }
  }

  // main pass

  for (const node of p.body) {
    switch (node.type) {
      case 'ImportDeclaration': {
        const importSource = node.source.value as string;
        out.mod.addSource(importSource);

        for (const s of node.specifiers) {
          const local = s.local.name;
          switch (s.type) {
            case 'ImportNamespaceSpecifier':
              out.mod.addGlobalImport(importSource, local);
              break;
            case 'ImportDefaultSpecifier':
              out.mod.addImport(importSource, local, 'default');
              break;
            case 'ImportSpecifier':
              out.mod.addImport(importSource, local, nodeToString(s.imported));
              break;
          }
        }
        break;
      }

      case 'ExportAllDeclaration':
        // this is a re-export of all
        out.mod.markExportAllFrom(node.source.value as string);
        continue;

      case 'ExportNamedDeclaration':
        if (!node.declaration) {
          const names: { exportedName: string; name: string }[] = [];

          for (const s of node.specifiers) {
            names.push({ exportedName: nodeToString(s.exported), name: nodeToString(s.local) });
          }

          if (node.source) {
            // direct re-export
            const importSource = node.source.value as string;
            out.mod.addSource(importSource);

            for (const { exportedName, name } of names) {
              out.mod.addExportFrom(importSource, exportedName, name);
            }
          } else {
            // local export
            for (const { exportedName, name } of names) {
              out.mod.addExportLocal(exportedName, name);
            }
          }
          continue;
        } else if (node.declaration.type === 'VariableDeclaration') {
          const isConst = node.declaration.kind === 'const';

          for (const s of node.declaration.declarations) {
            const p = processPattern(s.id);
            p.names.forEach((name) => {
              out.mod.addExportLocal(name);
              isConst && out.localConst.add(name);
            });
          }

          out.rest.push(node.declaration);
          continue;
        }
      // fall-through

      case 'ExportDefaultDeclaration': {
        const d = node.declaration!;
        const isDefault = node.type === 'ExportDefaultDeclaration';

        switch (d.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration':
            break;

          case 'VariableDeclaration':
            throw new Error(`TS confused`);

          default: // default is an expr, so evaluated immediately: always const
            out.mod.addExportLocal('default', 'default');
            out.localConst.add('default');
            out.rest.push(buildFakeDefaultConst(d));
            continue;
        }

        if (d.id && isDefault) {
          // e.g., "export default class foo {}; foo = 123;"
          out.mod.addExportLocal('default', d.id.name);
        } else if (d.id) {
          // normal
          out.mod.addExportLocal(d.id.name, d.id.name);
        } else if (isDefault) {
          // can't reassign unnamed declaration
          out.mod.addExportLocal('default', 'default');
          out.localConst.add('default');
        } else {
          throw new Error(`unnamed declaration`);
        }

        out.rest.push({ ...d, id: d.id || fakeDefaultIdentifier });
        continue;
      }

      case 'VariableDeclaration':
        out.rest.push(node);

        if (node.kind !== 'const') {
          continue;
        }

        // store top-level const in case it's exported as something else
        for (const s of node.declarations) {
          const p = processPattern(s.id);
          p.names.forEach((name) => out.localConst.add(name));
        }
        continue;

      default: // boring expr
        out.rest.push(node);
        continue;
    }
  }

  return out;
}
