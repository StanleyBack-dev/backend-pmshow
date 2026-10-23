import DataLoader from "dataloader";

type LoaderContext = { loaders?: Map<string, DataLoader<string, unknown>> };

/**
 * A DataLoader that lives for one GraphQL request (stored in its context):
 * field resolvers asking for the same kind of record are batched into one
 * query and repeated keys are served from memory.
 */
export function requestLoader<V>(
  context: object,
  name: string,
  batch: (keys: readonly string[]) => Promise<Map<string, V>>,
): DataLoader<string, V | null> {
  const holder = context as LoaderContext;
  holder.loaders ??= new Map();
  let loader = holder.loaders.get(name) as
    DataLoader<string, V | null> | undefined;
  if (!loader) {
    loader = new DataLoader<string, V | null>(async (keys) => {
      const found = await batch(keys);
      return keys.map((key) => found.get(key) ?? null);
    });
    holder.loaders.set(name, loader as DataLoader<string, unknown>);
  }
  return loader;
}
