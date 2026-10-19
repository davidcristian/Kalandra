import { type BaseType, type DropEntry, ITEM_BY_REF } from "@/assets/data";

export interface RelatedItem<P> {
  name: string;
  icon: string;
  price?: P;
}

export interface RelatedItems<P> {
  related: Array<RelatedItem<P> & { highlight: boolean }>;
  items: Array<RelatedItem<P>>;
}

/** Splits a drop group ref such as `UNIQUE::Name // Base` into its parts. */
export function splitQueryId(queryId: string) {
  const [ns, encodedName = ""] = queryId.split("::");
  const [name, variant] = encodedName.split(" // ");
  return { ns, name, variant };
}

/** Returns the item a ref names, preferring the unique on the ref's base item. */
export function findItemByQueryId(queryId: string): BaseType | undefined {
  const { ns, name, variant } = splitQueryId(queryId);
  const found = ITEM_BY_REF(ns as BaseType["namespace"], name);
  if (!found?.length) return undefined;
  if (ns === "UNIQUE") {
    return found.find((unique) => unique.unique?.base === variant) ?? found[0];
  }
  return found[0];
}

/** Lists the drop group that contains `queryId`, without the refs `findItem` cannot find. */
export function buildRelatedItems<P>(
  queryId: string,
  drops: readonly DropEntry[],
  findItem: (queryId: string) => BaseType | undefined,
  findPrice: (queryId: string) => P | undefined,
): RelatedItems<P> | null {
  const entry = drops.find((drop) => drop.query.includes(queryId));
  if (!entry) return null;

  const lookup = (ref: string): RelatedItem<P> | undefined => {
    const item = findItem(ref);
    return item && { name: item.name, icon: item.icon, price: findPrice(ref) };
  };

  const related = entry.query.flatMap((ref) => {
    const item = lookup(ref);
    return item ? [{ ...item, highlight: ref === queryId }] : [];
  });
  const items = entry.items.flatMap((ref) => lookup(ref) ?? []);
  if (!related.length && !items.length) return null;

  return { related, items };
}
