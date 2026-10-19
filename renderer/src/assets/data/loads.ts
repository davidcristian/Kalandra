import { shallowRef } from "vue";

const loads = shallowRef(0);

/** Records a finished load of the item data, so every cache from `cachePerDataLoad` builds again. */
export function markItemDataLoaded(): void {
  loads.value += 1;
}

/** Returns a function that builds the value of a key once per item data load; a computed that calls it runs again after the next load. */
export function cachePerDataLoad<K, V>(build: (key: K) => V): (key: K) => V {
  let builtFor = -1;
  const cache = new Map<K, V>();
  return (key) => {
    if (builtFor !== loads.value) {
      cache.clear();
      builtFor = loads.value;
    }
    if (!cache.has(key)) cache.set(key, build(key));
    return cache.get(key)!;
  };
}
