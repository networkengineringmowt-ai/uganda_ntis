import { useState, useEffect, useCallback } from 'react'

interface MediaItem { id: string; file: string; type: 'image'|'video'; source: string; title: string }

function Lightbox({ items, index, onClose, onNav }: { items: MediaItem[]; index: number; onClose: ()=>void; onNav: (d:number)=>void }) {
  const item = items[index]
  const url = `${import.meta.env.BASE_URL}${item.file}`
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if(e.key==='Escape') onClose(); if(e.key==='ArrowLeft') onNav(-1); if(e.key==='ArrowRight') onNav(1) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose, onNav])
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.93)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{position:'relative',maxWidth:'92vw',maxHeight:'92vh',display:'flex',flexDirection:'column',gap:8}}>
        {item.type==='video'
          ? <video src={url} controls autoPlay style={{maxWidth:'90vw',maxHeight:'82vh',borderRadius:12}}/>
          : <img src={url} alt={item.title} style={{maxWidth:'90vw',maxHeight:'82vh',objectFit:'contain',borderRadius:12}}/>}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px'}}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{item.title}</span>
          <div style={{display:'flex',gap:8}}>
            <a href={url} download={item.id} style={{background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'4px 12px',color:'white',fontSize:12,textDecoration:'none'}}>⬇ Download</a>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,padding:'4px 12px',color:'white',cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <button onClick={e=>{e.stopPropagation();onNav(-1)}} style={{position:'absolute',left:-48,top:'42%',background:'rgba(255,255,255,0.12)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',fontSize:22,cursor:'pointer'}}>‹</button>
        <button onClick={e=>{e.stopPropagation();onNav(1)}}  style={{position:'absolute',right:-48,top:'42%',background:'rgba(255,255,255,0.12)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',fontSize:22,cursor:'pointer'}}>›</button>
      </div>
    </div>
  )
}

export default function MediaSection() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [filter, setFilter] = useState<'all'|'image'|'video'>('all')
  const [lightbox, setLightbox] = useState<number|null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}media/gallery/manifest.json`)
      .then(r=>r.json()).then(setItems).catch(()=>setItems([])).finally(()=>setLoading(false))
  }, [])
  const filtered = items.filter(i => filter==='all' || i.type===filter)
  const navigate = useCallback((d:number) => setLightbox(prev => prev===null ? null : (prev+d+filtered.length)%filtered.length), [filtered.length])
  const pills = [{k:'all' as const,label:`All (${items.length})`},{k:'image' as const,label:`Images (${items.filter(i=>i.type==='image').length})`},{k:'video' as const,label:`Videos (${items.filter(i=>i.type==='video').length})`}]
  return (
    <section id="media" style={{padding:'32px 24px',minHeight:'100vh',color:'white'}}>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:4,color:'#e2e8f0'}}>Media Gallery</h2>
      <p style={{color:'rgba(148,163,184,0.7)',fontSize:13,marginBottom:20}}>Road network imagery &amp; annual monitoring footage</p>
      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
        {pills.map(({k,label})=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:'6px 16px',borderRadius:20,border:'1px solid',fontSize:12,fontWeight:600,cursor:'pointer',background:filter===k?'rgba(99,102,241,0.2)':'rgba(255,255,255,0.04)',borderColor:filter===k?'#6366f1':'rgba(255,255,255,0.1)',color:filter===k?'#a5b4fc':'rgba(148,163,184,0.6)'}}>{label}</button>
        ))}
      </div>
      {loading && <p style={{color:'rgba(148,163,184,0.5)'}}>Loading media…</p>}
      {!loading && filtered.length===0 && <p style={{color:'rgba(148,163,184,0.5)'}}>No media available yet.</p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
        {filtered.map((item,i)=>{
          const url=`${import.meta.env.BASE_URL}${item.file}`
          return (
            <div key={item.id} onClick={()=>setLightbox(i)} style={{background:'rgba(15,23,42,0.45)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'transform 0.2s',position:'relative'}} onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-3px)')} onMouseLeave={e=>(e.currentTarget.style.transform='translateY(0)')}>
              {item.type==='video'
                ? <div style={{height:140,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>▶</div>
                : <img src={url} alt={item.title} style={{width:'100%',height:140,objectFit:'cover',display:'block'}} loading="lazy"/>}
              <div style={{padding:'8px 10px'}}>
                <p style={{fontSize:11,color:'rgba(148,163,184,0.8)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:0}}>{item.title}</p>
                <p style={{fontSize:10,color:'rgba(100,116,139,0.6)',margin:'2px 0 0',textTransform:'uppercase'}}>{item.source}</p>
              </div>
            </div>
          )
        })}
      </div>
      {lightbox!==null && <Lightbox items={filtered} index={lightbox} onClose={()=>setLightbox(null)} onNav={navigate}/>}
    </section>
  )
}
