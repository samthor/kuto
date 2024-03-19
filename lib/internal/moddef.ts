import { relativize, withDefault } from '../helper.ts';

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

export type ImportInfo = {
  import: string;
  remote: string;
};

/**
 * ModDef contains mutable module import/export information for a single file.
 */
export class ModDef {
  private bySource: Map<string, SourceInfo> = new Map();
  private byLocalName: Map<string, ImportInfo> = new Map();
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

  *exported(): Generator<{ exportedName: string; import?: string; name: string }, void, void> {
    for (const [exportedName, info] of this._exports) {
      yield { exportedName, ...info };
    }
  }

  lookupImport(name: string): ImportInfo | undefined {
    const o = this.byLocalName.get(name);
    return o ? { ...o } : undefined;
  }

  addSource(importSource: string): SourceInfo {
    return withDefault(this.bySource, importSource, () => ({
      imports: new Map(),
      exports: new Map(),
      reexportAll: false,
    }));
  }

  private _addImport(importSource: string, localName: string, remoteName: string) {
    const prev = this.byLocalName.get(localName);
    if (prev) {
      if (prev.import !== importSource || prev.remote !== remoteName) {
        // only throw if different
        throw new Error(`already local: ${localName} from ${importSource}`);
      }
      return;
    }

    if (localName === '') {
      throw new Error(`can't have blank localName`);
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

  removeImport(localName: string) {
    const prev = this.byLocalName.get(localName);
    if (!prev) {
      return false;
    }

    this.byLocalName.delete(localName);
    const info = this.bySource.get(prev.import)!;
    const s = withDefault(info.imports, prev.remote, () => new Set());
    s.delete(localName);
    if (s.size === 0) {
      info.imports.delete(prev.remote);
    }
    return false;
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
    const prev = this._exports.get(exportedName);
    if (prev) {
      if (prev.import || prev.name !== sourceName) {
        // only throw if different
        throw new Error(`already exported: ${exportedName}`);
      }
      return;
    }
    const p = { name: sourceName };
    this._exports.set(exportedName, p);
    this.allLocalExported.set(exportedName, p);
  }

  removeExportLocal(exportedName: string) {
    const prev = this._exports.get(exportedName);
    if (!prev) {
      return false;
    }
    this._exports.delete(exportedName);
    this.allLocalExported.delete(exportedName);
    return true;
  }

  renderSource() {
    const lines: string[] = [];

    for (const [path, info] of this.bySource) {
      const pj = JSON.stringify(relativize(path));
      let any = false;

      for (const localName of info.imports.get('') ?? []) {
        lines.push(`import * as ${localName} from ${pj}`);
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
        lines.push(`import { ${parts.join(', ')} } from ${pj}`);
        any = true;
      }

      if (info.reexportAll) {
        lines.push(`export * from ${pj}`);
      }

      // TODO: if these are here with local names, we could instead pick one and re-export
      const reexportParts: string[] = [];
      for (const [remote, exported] of info.exports) {
        for (const e of exported) {
          reexportParts.push(safeImportAs(remote, e));
        }
      }
      if (reexportParts.length) {
        lines.push(`export { ${reexportParts.join(', ')} } from ${pj}`);
        any = true;
      }

      if (!any) {
        lines.push(`import ${pj}`);
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
