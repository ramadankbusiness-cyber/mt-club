export function createMockQuery(data = null, error = null) {
  const q = {
    _result: { data, error },
    select: () => q,
    insert: () => q,
    update: () => q,
    delete: () => q,
    eq: () => q,
    neq: () => q,
    ilike: () => q,
    in: () => q,
    order: () => q,
    limit: () => q,
    single: () => Promise.resolve({ data, error }),
    maybeSingle: () => Promise.resolve({ data, error }),
    upsert: () => q,
    then: (resolve, reject) => {
      const p = Promise.resolve({ data, error });
      return p.then(resolve, reject);
    },
    catch: (fn) => {
      return Promise.resolve({ data, error }).catch(fn);
    },
  };
  return q;
}
