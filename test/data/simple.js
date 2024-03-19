const MyComponent = class extends HTMLElement {
  constructor() {
    super();
    this.root = ignore;
  }
};

customElements.define('my-component', MyComponent);
