import type { Adapter } from "@market-radar-pl/types";

export const adapterRegistry = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter): void {
  adapterRegistry.set(adapter.source, adapter);
}

export function getAdapter(source: string): Adapter | null {
  return adapterRegistry.get(source) ?? null;
}
