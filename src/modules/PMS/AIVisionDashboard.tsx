import { useState, useEffect } from 'react';
import { Camera, Activity, AlertTriangle, Scan, Server, FileVideo, Cpu } from 'lucide-react';

export default function AIVisionDashboard() {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate initial scan
    setAnalyzing(true);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setAnalyzing(false);
          return 100;
        }
        return p + 5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#0a0f1e' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#00f5ff', marginBottom: 8, fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={20} />
            CNN VISION & VCI PIPELINE
          </h2>
          <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>
            Real-time automated defect identification from ROMDAS video streams
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', padding: '6px 12px', borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
            <span style={{ fontSize: 11, color: '#00ff88', fontWeight: 700 }}>AI Backend Connected</span>
          </div>
        </div>
      </div>

      {/* Main Analysis View */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20 }}>
        
        {/* Video Feed & Detection */}
        <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(0,245,255,0.15)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(4,9,18,0.8)', borderBottom: '1px solid rgba(0,245,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2eaf4', fontSize: 12, fontWeight: 700 }}>
              <FileVideo size={16} color="#00f5ff" /> Live Inference Stream: A001_Link03
            </div>
            <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 11, fontFamily: 'monospace' }}>
              CH 14+320 | FPS: 24 | GPU: NVIDIA A100
            </div>
          </div>
          
          <div style={{ position: 'relative', flex: 1, minHeight: 400, background: '#000' }}>
            <img 
              src={`${import.meta.env.BASE_URL}media/romdas_sample.jpg`} 
              alt="ROMDAS Frame"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: analyzing ? 0.5 : 1, transition: 'opacity 0.3s' }}
            />
            
            {/* Simulated Scanner Line */}
            {analyzing && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: '#00f5ff',
                boxShadow: '0 0 10px #00f5ff, 0 0 20px #00f5ff',
                animation: 'scan-line 2s infinite linear'
              }} />
            )}

            {/* Bounding Boxes (Only show when analysis complete) */}
            {!analyzing && (
              <>
                <div style={{ position: 'absolute', top: '40%', left: '30%', width: '15%', height: '15%', border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -20, left: -2, background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                    Pothole 94%
                  </div>
                </div>
                <div style={{ position: 'absolute', top: '60%', left: '55%', width: '25%', height: '10%', border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.1)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -20, left: -2, background: '#f59e0b', color: '#fff', fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                    Crocodile Cracking 88%
                  </div>
                </div>
              </>
            )}

            <style>{`
              @keyframes scan-line {
                0% { top: 0; }
                50% { top: 100%; }
                100% { top: 0; }
              }
            `}</style>
          </div>
        </div>

        {/* Inference Stats & VCI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(0,245,255,0.15)', borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: '#00f5ff', fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Automated VCI Calculation</h3>
            
            {analyzing ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Activity size={32} color="#00f5ff" style={{ animation: 'pms-spin 1s infinite linear', marginBottom: 12 }} />
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)' }}>Processing Frame... {progress}%</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>58.5</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,158,11,0.8)', fontWeight: 700 }}>CONDITION: FAIR</div>
                </div>
                
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', marginBottom: 4 }}>Defect Deductions:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
                    <span style={{ color: '#e2eaf4' }}>Base VCI</span>
                    <span style={{ color: '#00ff88' }}>100.0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
                    <span style={{ color: '#ef4444' }}>Pothole (x1)</span>
                    <span style={{ color: '#ef4444' }}>-15.5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(245,158,11,0.1)', padding: '6px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#f59e0b' }}>Crocodile Cracking (10m²)</span>
                    <span style={{ color: '#f59e0b' }}>-26.0</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(0,245,255,0.15)', borderRadius: 8, padding: 16, flex: 1 }}>
            <h3 style={{ color: '#00f5ff', fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>System Telemetry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11, color: 'rgba(148,163,184,0.9)' }}>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Model:</span> ResNet50 + Faster R-CNN</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Latency:</span> 42ms / frame</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Confidence:</span> 0.89 avg</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Active Drive:</span> U:\ROMDAS Videos 2023-24</div>
            </div>
            
            <button 
              onClick={() => { setProgress(0); setAnalyzing(true); }}
              style={{ width: '100%', marginTop: 24, padding: '8px', background: 'rgba(0,245,255,0.1)', border: '1px solid #00f5ff', color: '#00f5ff', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
              Rescan Frame
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
