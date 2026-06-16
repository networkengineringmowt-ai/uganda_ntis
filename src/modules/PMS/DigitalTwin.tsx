import { useEffect, useRef, useState } from 'react';
import { Cuboid, Layers, Activity } from 'lucide-react';

// CesiumJS is loaded at runtime from the CDN (see loadCesium below).
declare global {
  interface Window { Cesium?: any }
}

export default function DigitalTwin() {
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load CesiumJS script and styles
    const loadCesium = () => {
      if (window.Cesium) {
        initCesium();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.116/Build/Cesium/Widgets/widgets.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.116/Build/Cesium/Cesium.js';
      script.async = true;
      script.onload = () => {
        setLoaded(true);
        initCesium();
      };
      document.body.appendChild(script);
    };

    const initCesium = () => {
      if (!cesiumContainer.current || viewerRef.current) return;
      
      const Cesium = window.Cesium;
      // Initialize Viewer
      const viewer = new Cesium.Viewer(cesiumContainer.current, {
        infoBox: false,
        selectionIndicator: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        fullscreenButton: false,
      });
      viewerRef.current = viewer;

      // Disable lighting to see raw colors better
      viewer.scene.globe.enableLighting = false;

      // Define Layers
      const polygonHierarchy = Cesium.Cartesian3.fromDegreesArray([
        32.5825, 0.3476,
        32.5826, 0.3476,
        32.5826, 0.3480,
        32.5825, 0.3480
      ]);

      const layers = [
        { name: "Wearing Course (Asphalt)", color: Cesium.Color.fromCssColorString('#1a202c').withAlpha(0.9), h: 1140, ex: 1140.05 },
        { name: "Base Course (Crushed Stone)", color: Cesium.Color.fromCssColorString('#718096').withAlpha(0.9), h: 1139.85, ex: 1140 },
        { name: "Subbase (Gravel)", color: Cesium.Color.fromCssColorString('#a0aec0').withAlpha(0.9), h: 1139.65, ex: 1139.85 },
        { name: "Subgrade (Earth)", color: Cesium.Color.fromCssColorString('#8b4513').withAlpha(0.9), h: 1139.15, ex: 1139.65 },
      ];

      layers.forEach(l => {
        viewer.entities.add({
          name: l.name,
          polygon: {
            hierarchy: polygonHierarchy,
            height: l.h,
            extrudedHeight: l.ex,
            material: l.color,
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          }
        });
      });

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(32.58255, 0.3478, 20),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-30.0),
        }
      });
    };

    loadCesium();
    
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#020508' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#00f5ff', marginBottom: 8, fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cuboid size={20} />
            3D DIGITAL TWIN (CESIUM)
          </h2>
          <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>
            Geospatial pavement structural model and geometry visualization
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(0,245,255,0.2)', padding: '6px 12px', borderRadius: 6, fontSize: 11, color: '#e2eaf4' }}>
            <Layers size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
            Link: A001_Link03
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', marginTop: 16 }}>
        {!loaded && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020508', zIndex: 20 }}>
            <Activity size={32} color="#00f5ff" style={{ animation: 'pms-spin 1s infinite linear' }} />
          </div>
        )}
        <div ref={cesiumContainer} style={{ width: '100%', height: '100%' }} />

        {/* Floating Legend */}
        <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(4,9,18,0.85)', border: '1px solid rgba(0,245,255,0.2)', padding: 16, borderRadius: 8, backdropFilter: 'blur(8px)', zIndex: 10 }}>
          <h4 style={{ color: '#00f5ff', fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Structural Layers</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fff' }}>
              <div style={{ width: 12, height: 12, background: '#1a202c', border: '1px solid #00f5ff', borderRadius: 2 }} />
              <span>Wearing Course (Asphalt)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fff' }}>
              <div style={{ width: 12, height: 12, background: '#718096', border: '1px solid transparent', borderRadius: 2 }} />
              <span>Base Course</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fff' }}>
              <div style={{ width: 12, height: 12, background: '#a0aec0', border: '1px solid transparent', borderRadius: 2 }} />
              <span>Subbase</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fff' }}>
              <div style={{ width: 12, height: 12, background: '#8b4513', border: '1px solid transparent', borderRadius: 2 }} />
              <span>Subgrade</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
