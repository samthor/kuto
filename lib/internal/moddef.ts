function withDefault<K, V>(m: Map<K, V>, k: K, build: (k: K) => V): V {
  if (m.has(k)) {
    return m.get(k)!;
  }
  const update = build(k);
  m.set(k, update);
  return update;
}

type SourceInfo = {
  /**
   * Remote name (singular) to all local name(s).
   */
  imports: Map<string, Set<string>>;

  /**
   * Remote name (singular) to directly exported name(s).
   */
  exports: Map<string, Set<string>>;

  /**
   * Whether we include a re-export of all.
   */
  reexportAll: boolean;
};

function safeImportAs(from: string, to: string = from) {
  // TODO: make actually safe
  if (from === to) {
    return from;
  }
  return `${from} as ${to}`;
}

/**
 * ModDef contains mutable module import/export information for a single file.
 */
export class ModDef {
  private bySource: Map<string, SourceInfo> = new Map();
  private byLocalName: Map<string, { import: string; remote: string }> = new Map();
  private _exports: Map<string, { import?: string; name: string }> = new Map();
  private allLocalExported: Map<string, { name: string }> = new Map();

  /**
   * Yields the names of local variables that are later exported.
   * Does not yield their exported name(s).
   */
  *localExported(): Generator<string, void, void> {
    const seen = new Set<string>();
    for (const info of this._exports.values()) {
      if (info.import || seen.has(info.name)) {
        continue;
      }
      seen.add(info.name);
      yield info.name;
    }
  }

  lookupImport(name: string): { import: string; remote: string } | undefined {
    const o = this.byLocalName.get(name);
    return o ? { ...o } : undefined;
  }

  exports() {
    return this._exports;
  }

  addSource(importSource: string): SourceInfo {
    return withDefault(this.bySource, importSource, () => ({
      imports: new Map(),
      exports: new Map(),
      reexportAll: false,
    }));
  }

  private _addImport(importSource: string, localName: string, remoteName: string) {
    if (localName === '') {
      throw new Error(`can't have blank localName`);
    } else if (this.byLocalName.has(localName)) {
      throw new Error(`already local: ${localName}`);
    }
    this.byLocalName.set(localName, { import: importSource, remote: remoteName });

    const info = this.addSource(importSource);
    const s = withDefault(info.imports, remoteName, () => new Set());
    s.add(localName);
  }

  addGlobalImport(importSource: string, localName: string) {
    return this._addImport(importSource, localName, '');
  }

  addImport(importSource: string, localName: string, remoteName: string = localName) {
    if (remoteName === '') {
      throw new Error(`can't have blank remoteName`);
    }
    return this._addImport(importSource, localName, remoteName);
  }

  addExportFrom(importSource: string, exportedName: string, remoteName: string = '') {
    if (this._exports.has(exportedName)) {
      throw new Error(`already exported: ${exportedName}`);
    }
    this._exports.set(exportedName, { import: importSource, name: remoteName });

    const info = this.addSource(importSource);
    const s = withDefault(info.exports, remoteName, () => new Set());
    s.add(exportedName);
  }

  markExportAllFrom(importSource: string) {
    const info = this.addSource(importSource);
    info.reexportAll = true;
  }

  addExportLocal(exportedName: string, sourceName: string = exportedName) {
    if (this._exports.has(exportedName)) {
      throw new Error(`already exported: ${exportedName}`);
    }
    const p = { name: sourceName };
    this._exports.set(exportedName, p);
    this.allLocalExported.set(exportedName, p);
  }

  renderSource() {
    const lines: string[] = [];

    for (const [path, info] of this.bySource) {
      // if (path === '') {
      //   // special-case
      //   if (info.imports.size || info.reexportAll) {
      //     console.debug(info);
      //     throw new Error(`bad for empty path`);
      //   }
      //   if (info.reexport.size) {
      //     const parts: string[] = [];
      //     for (const [remote, exported] of info.reexport) {
      //       for (const e of exported) {
      //         parts.push(safeImportAs(remote, e));
      //       }
      //     }
      //     lines.push(`export { ${parts.join(', ')} }`);
      //   }
      //   continue;
      // }

      let any = false;

      for (const localName of info.imports.get('') ?? []) {
        lines.push(`import * as ${localName} from ${JSON.stringify(path)}`);
        any = true;
      }

      const parts: string[] = [];
      for (const [remote, local] of info.imports) {
        if (remote === '') {
          continue;
        }
        for (const l of local) {
          parts.push(safeImportAs(remote, l));
        }
      }
      if (parts.length) {
        lines.push(`import { ${parts.join(', ')} } from ${JSON.stringify(path)}`);
        any = true;
      }

      if (info.reexportAll) {
        lines.push(`export * from ${JSON.stringify(path)}`);
      }

      // TODO: if these are here with local names, we could instead pick one and re-export
      const reexportParts: string[] = [];
      for (const [remote, exported] of info.exports) {
        for (const e of exported) {
          reexportParts.push(safeImportAs(remote, e));
        }
      }
      if (reexportParts.length) {
        lines.push(`export { ${reexportParts.join(', ')} } from ${JSON.stringify(path)}`);
        any = true;
      }

      if (!any) {
        lines.push(`import ${JSON.stringify(path)}`);
      }
    }

    if (this.allLocalExported.size) {
      const parts: string[] = [];
      for (const [remote, { name }] of this.allLocalExported) {
        parts.push(safeImportAs(name, remote));
      }
      lines.push(`export { ${parts.join(', ')} }`);
    }

    lines.push('');
    return lines.join(';\n');
  }
}
