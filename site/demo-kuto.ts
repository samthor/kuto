import { parse } from 'acorn';
import { StaticExtractor } from '../lib/extractor.ts';
import { buildCorpusName } from '../lib/name.ts';
import { liftDefault } from '../lib/lift.ts';

export class DemoKutoElement extends HTMLElement {
  private root: ShadowRoot;
  private textarea: HTMLTextAreaElement;
  private article: HTMLElement;
  private priors?: Map<string, string>;
  private buildCount: number = 0;
  private statusEl: HTMLElement;

  constructor() {
    super();

    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
<style>
main {
  display: grid;
  grid-template-columns: 1fr 2fr;
}
textarea {
  resize: none;
  height: 20em;
  font-size: var(--code-size);
  margin-bottom: 1em;
}
header {
  display: flex;
  flex-flow: column;
}

article > pre {
  background: #f003;
  white-space: pre-wrap;
  margin: 0 1em 1em;
  font-size: var(--code-size);

  &.corpus {
    background: #00f3;
  }

  &.gone {
    opacity: 0.5;
  }
}

.actions {
  border-top: 2px solid #ccc;
  padding-top: 1em;

  margin: 0 1em 1em;
  font-size: var(--code-size);

  button {
    font-family: monospace;
  }
}

#status {
  color: red;
}
</style>

<main>
  <header>
    <textarea></textarea>
    <button autofocus>Split with Kuto</button>
    <div id="status"></div>
  </header>
  <article></article>
</main>
    `;

    this.article = this.root.querySelector('article')!;
    const textarea = this.root.querySelector('textarea')!;
    const button = this.root.querySelector('button')!;
    button.addEventListener('click', async () => {
      try {
        await this.run(textarea.value);
      } catch (e) {
        console.warn(e);
      }
    });
    this.textarea = textarea;

    this.statusEl = this.root.getElementById('status')!;
  }

  private async run(source: string) {
    const p = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const staticName = buildCorpusName('./src.js');

    const e = new StaticExtractor({
      p,
      source,
      sourceName: './src.js',
      staticName,
      existingStaticSource: this.priors ?? new Map(),
      dedupCallables: false,
    });
    const liftStats = liftDefault(e, 32);

    const out = e.build({ pretty: true });
    console.info({ liftStats, out });

    const localBuild = ++this.buildCount;
    this.statusEl.textContent = `Build #${localBuild}`;

    this.article.textContent = '';

    const render = (content: string, filename: string, className = '') => {
      const out = document.createElement('pre');
      out.textContent = content;
      out.id = `code-${generateId(filename)}`;

      if (filename) {
        const heading = document.createElement('strong');
        heading.textContent = `// ${filename}\n`;
        out.prepend(heading);
      }

      if (className) {
        out.className = className;
      }

      this.article.append(out);
      return out;
    };

    render(out.main, './src.js');

    const outByName = [...out.static.keys()];
    outByName.sort();

    outByName.forEach((name) => {
      const content = out.static.get(name)!;

      const actions = document.createElement('div');
      actions.className = 'actions';
      this.article.append(actions);

      const node = render(content, name, 'corpus');

      const deleteNode = document.createElement('button');
      deleteNode.textContent = `Remove ${name}`;
      actions.append(deleteNode);

      deleteNode.addEventListener('click', () => {
        deleteNode.disabled = true;
        node.classList.add('gone');
        this.priors?.delete(name);
      });
    });

    this.priors = out.static;
  }

  set value(v: string) {
    this.textarea.value = v;
  }
}

const generateId = (filename: string) => {
  const chars = Array.from(btoa(filename));
  chars.reverse();
  while (chars[0] === '=') {
    chars.shift();
  }
  return chars.join('');
};

customElements.define('demo-kuto', DemoKutoElement);
