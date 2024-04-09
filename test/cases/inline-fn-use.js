const hoistable_what = async function hoistable() {
  // just a really long function
};

let randomGlobal = 123;

hoistable_what().then((out) => {
  randomGlobal;
});

export { hoistable_what };
