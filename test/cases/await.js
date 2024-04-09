let ok = false;

const doGlobal = () => {
  ok = true;
};

const complexExpressionThatIsLong = async () => {
  await Promise.resolve();
  doGlobal();
};
await complexExpressionThatIsLong();

if (!ok) {
  throw new Error(`did not await`);
}

await (1 + 2 + 3 + 4 + 1 + 2 + 3 + 4 + 1 + 2 + 3 + 4 + 1 + 2 + 3 + 4);

const complexAwaited = () => {
  return +55; // long is long long long ong
};

const y = await (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + complexAwaited());
console.info(y);

const asyncInlineMethod = async (x = 123) => {
  console.info('long fn expr');
  await 123; // force await check
};
