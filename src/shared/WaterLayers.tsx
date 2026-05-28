import { GeoJSON } from 'react-leaflet';
import { useWaterLayers } from '../hooks/useWaterLayers';

const LAKE_STYLE = {
  color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 0.35,
  weight: 1, opacity: 0.5,
};
const RIVER_STYLE = {
  color: '#60a5fa', fillColor: 'none', fillOpacity: 0,
  weight: 1.5, opacity: 0.55,
};

export function WaterLayers() {
  const { lakes, rivers } = useWaterLayers();
  return (
    <>
      {lakes  && <GeoJSON key="wl-lakes"  data={lakes  as never} style={() => LAKE_STYLE}  />}
      {rivers && <GeoJSON key="wl-rivers" data={rivers as never} style={() => RIVER_STYLE} />}
    </>
  );
}
