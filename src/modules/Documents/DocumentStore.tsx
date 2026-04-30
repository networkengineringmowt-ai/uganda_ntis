import { useState, useMemo } from 'react';
import { FolderOpen, Search, Plus, FileText, Image, File, Download, Upload } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { BridgeDocument, DocumentCategory } from '../../types';
import { formatDate } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Design Drawing':     <FileText size={14} className="text-blue-400" />,
  'Inspection Report':  <FileText size={14} className="text-green-400" />,
  'As-Built':           <FileText size={14} className="text-cyan-400" />,
  'Contract':           <FileText size={14} className="text-purple-400" />,
  'Photo':              <Image size={14} className="text-amber-400" />,
  'Maintenance Record': <FileText size={14} className="text-orange-400" />,
  'Environmental':      <FileText size={14} className="text-lime-400" />,
  'Other':              <File size={14} className="text-slate-400" />,
};

const CATEGORIES: DocumentCategory[] = [
  'Design Drawing', 'Inspection Report', 'As-Built', 'Contract',
  'Photo', 'Maintenance Record', 'Environmental', 'Other',
];

export default function DocumentStore() {
  const { state, dispatch } = useBMS();
  const { documents, structures } = state;

  const [query,    setQuery]    = useState('');
  const [catFilter, setCat]     = useState<'all' | DocumentCategory>('all');
  const [typeFilter, setType]   = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;

  const fileTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.fileType));
    return ['all', ...Array.from(types).sort()];
  }, [documents]);

  const filtered = useMemo(() => {
    let list = [...documents].sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
    if (catFilter !== 'all') list = list.filter(d => d.category === catFilter);
    if (typeFilter !== 'all') list = list.filter(d => d.fileType === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.structureName.toLowerCase().includes(q) ||
        d.structureId.toLowerCase().includes(q) ||
        d.uploadedBy.toLowerCase().includes(q),
      );
    }
    return list;
  }, [documents, query, catFilter, typeFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats by category
  const catStats = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
    return counts;
  }, [documents]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Category strip */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-slate-700/60 bg-slate-900/50 overflow-x-auto">
        <button
          onClick={() => { setCat('all'); setPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
            ${catFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
        >
          <FolderOpen size={12} /> All ({documents.length})
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setCat(cat); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
              ${catFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            {CATEGORY_ICONS[cat]} {cat} ({catStats[cat] || 0})
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="bms-input pl-9 py-1.5 text-xs" placeholder="Search documents…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
          </div>
          <select className="bms-select text-xs py-1.5" value={typeFilter} onChange={e => setType(e.target.value)}>
            {fileTypes.map(t => <option key={t}>{t === 'all' ? 'All File Types' : t}</option>)}
          </select>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} documents</span>
          <button onClick={() => setShowForm(true)} className="bms-btn-primary text-xs py-1.5">
            <Plus size={13} /> Attach Document
          </button>
        </div>
      </div>

      {/* Document grid / table */}
      <div className="flex-1 overflow-auto">
        <table className="bms-table">
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Category</th>
              <th>Structure</th>
              <th>File Type</th>
              <th>Size</th>
              <th>Version</th>
              <th>Uploaded By</th>
              <th>Upload Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map(doc => (
              <DocRow key={doc.id} doc={doc} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/60 bg-slate-900/50 flex-shrink-0">
        <span className="text-xs text-slate-500">
          Showing {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">← Prev</button>
          <span className="text-xs text-slate-400">Page {page}/{pageCount}</span>
          <button onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={page===pageCount} className="bms-btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next →</button>
        </div>
      </div>

      {/* Upload form */}
      {showForm && (
        <DocUploadForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          onSave={doc => { dispatch({ type: 'ADD_DOCUMENT', payload: doc }); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function DocRow({ doc }: { doc: BridgeDocument }) {
  // Build S:\PHOTOS path for photo type
  const isPhoto = doc.category === 'Photo' || doc.fileType === 'JPG';
  const openPath = isPhoto
    ? `file:///S:/PHOTOS/${doc.structureId.replace('BRG-', '')}/`
    : undefined;

  return (
    <tr className="hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {CATEGORY_ICONS[doc.category] ?? <File size={14} className="text-slate-400" />}
          <div>
            <div className="text-xs font-medium text-slate-200 max-w-[200px] truncate">{doc.name}</div>
            {doc.description && <div className="text-[10px] text-slate-500 truncate">{doc.description}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="badge badge-blue text-[9px]">{doc.category}</span>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-slate-300 max-w-[140px] truncate">{doc.structureName}</div>
        <div className="text-[10px] text-slate-500">{doc.structureId}</div>
      </td>
      <td className="px-4 py-3">
        <span className="badge badge-slate text-[9px]">{doc.fileType}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.fileSize}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.version}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.uploadedBy}</td>
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(doc.uploadedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isPhoto && openPath ? (
            <a
              href={openPath}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
              title="Open photo folder"
            >
              <Image size={12} />
            </a>
          ) : (
            <button
              className="p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
              title="Download (simulated)"
            >
              <Download size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Upload form ──────────────────────────────────────────────────────────────
function DocUploadForm({
  structures, onSave, onClose,
}: {
  structures: { id: string; name: string }[];
  onSave: (d: BridgeDocument) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    structureId:  structures[0]?.id ?? '',
    name:         '',
    category:     'Inspection Report' as DocumentCategory,
    description:  '',
    fileType:     'PDF',
    version:      '1.0',
    uploadedBy:   'DNR User',
  });

  function set(k: string, v: string) { setF(prev => ({ ...prev, [k]: v })); }

  function save() {
    const struct = structures.find(s => s.id === f.structureId);
    const doc: BridgeDocument = {
      id:             uuidv4(),
      structureId:    f.structureId,
      structureName:  struct?.name ?? f.structureId,
      name:           f.name || `${f.structureId}_${f.category}.${f.fileType.toLowerCase()}`,
      category:       f.category,
      description:    f.description,
      fileType:       f.fileType,
      fileSize:       'Pending',
      uploadedBy:     f.uploadedBy,
      uploadedAt:     new Date().toISOString().split('T')[0],
      version:        f.version,
    };
    onSave(doc);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-400" />
            <span className="font-bold text-white">Attach Document</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="bms-label">Structure</label>
            <select className="bms-select" value={f.structureId} onChange={e => set('structureId', e.target.value)}>
              {structures.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Category</label>
            <select className="bms-select" value={f.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="bms-label">Document Name</label>
            <input className="bms-input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="filename.pdf" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="bms-label">File Type</label>
              <select className="bms-select" value={f.fileType} onChange={e => set('fileType', e.target.value)}>
                {['PDF','DWG','XLSX','DOCX','JPG','PNG','DXF','SHP'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="bms-label">Version</label>
              <input className="bms-input" value={f.version} onChange={e => set('version', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="bms-label">Uploaded By</label>
            <input className="bms-input" value={f.uploadedBy} onChange={e => set('uploadedBy', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">Description</label>
            <textarea className="bms-input h-20 resize-none" value={f.description} onChange={e => set('description', e.target.value)} placeholder="Brief description…" />
          </div>
          {/* Note about S:\PHOTOS */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">
            📸 Bridge photos are automatically linked from <code className="font-mono">S:\PHOTOS\[BridgeID]\</code>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="bms-btn-secondary">Cancel</button>
          <button onClick={save} className="bms-btn-primary"><Upload size={14} /> Attach</button>
        </div>
      </div>
    </div>
  );
}
