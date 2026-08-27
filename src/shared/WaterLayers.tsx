// Lakes/rivers overlay intentionally disabled: the base map already shows
// this data, so rendering it again here would be redundant. Kept as a
// no-op component rather than removed at each call site so every map view
// that renders <WaterLayers /> is unaffected.
export function WaterLayers() {
  return null;
}
