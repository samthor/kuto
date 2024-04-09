(function () {
  console.info('Long to force hoist');
  process.exit(0);
})();

await import('./dep/a.js').then((complex) => {
  console.info('does something tricky');
});
