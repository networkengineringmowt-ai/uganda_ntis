// Module-level variable — set before navigating to sources so it pre-filters on mount
let _pendingModule: string | null = null;

export function setPendingSourcesModule(mod: string | null) {
  _pendingModule = mod;
}

export function consumePendingSourcesModule(): string | null {
  const v = _pendingModule;
  _pendingModule = null;
  return v;
}
