async function hoistable_with_long_name_to_make_statement_hoist() {
  console.info('long long long');
  return Promise.resolve(345);
}

const q = hoistable_with_long_name_to_make_statement_hoist();
q.then((out) => {
  console.info(out);
});

export { hoistable_with_long_name_to_make_statement_hoist as x };
