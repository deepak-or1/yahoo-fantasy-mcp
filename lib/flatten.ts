/** Normalize Yahoo's mechanically translated XML-as-JSON responses. */

function unwrapSameKey(items: unknown[]): unknown[] {
  if (
    items.length > 0 &&
    items.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        Object.keys(item).length === 1,
    )
  ) {
    const objects = items as Record<string, unknown>[];
    const keys = objects.map((item) => Object.keys(item)[0]);
    if (new Set(keys).size === 1) {
      return objects.map((item) => item[keys[0]]);
    }
  }
  return items;
}

export function flatten(value: unknown): unknown {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object);
    const numericKeys = keys.filter((key) => /^\d+$/.test(key));
    if (
      keys.length > 0 &&
      keys.every((key) => key === "count" || /^\d+$/.test(key))
    ) {
      const items = numericKeys
        .sort((left, right) => Number(left) - Number(right))
        .map((key) => flatten(object[key]));
      return unwrapSameKey(items);
    }

    return Object.fromEntries(
      Object.entries(object).map(([key, item]) => [key, flatten(item)]),
    );
  }

  if (Array.isArray(value)) {
    const items = value
      .map(flatten)
      .filter(
        (item) =>
          item !== "" &&
          item !== null &&
          !(Array.isArray(item) && item.length === 0) &&
          !(
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            Object.keys(item).length === 0
          ),
      );

    if (
      items.length > 0 &&
      items.every(
        (item) => typeof item === "object" && item !== null && !Array.isArray(item),
      )
    ) {
      const seen = new Set<string>();
      let disjoint = true;
      for (const item of items as Record<string, unknown>[]) {
        for (const key of Object.keys(item)) {
          if (seen.has(key)) {
            disjoint = false;
            break;
          }
          seen.add(key);
        }
        if (!disjoint) break;
      }
      if (disjoint) {
        return Object.assign({}, ...(items as Record<string, unknown>[]));
      }
    }

    // One manager is merged by R2, while repeated manager keys collide and
    // are unwrapped here by R3. This known asymmetry matches Yahoo's shape.
    return unwrapSameKey(items);
  }

  return value;
}
