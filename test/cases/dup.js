// has a callable; can't be deduped
export const x = () => 'This is very long and the same as below and will NOT be deduped';
export const y = () => 'This is very long and the same as below and will NOT be deduped';

export const a = "This is a long value which will be deduped as there's no callables";
export const b = "This is a long value which will be deduped as there's no callables";
