// ---------------------------------------------------------------------------
// AlphaProd Settings — My Profiles, Client Management, Document Styling.
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, Building2, Palette, Plus, X, Trash2, Upload, Check, Pencil, Save, Loader2
} from 'lucide-react';
import { upsertProfile, deleteProfile, upsertClient, deleteClient } from '../../lib/theatreAlpha';
import { uploadPOFile } from '../../lib/documents';

// ---------------------------------------------------------------------------
// Mock profiles & themes
// ---------------------------------------------------------------------------

const MOCK_PROFILES = [
  {
    id: 'prof1',
    company_name: 'Amphitheatre Film',
    address: '22/7 Soi Thonglor 9, Bangkok 10110',
    tax_id: '0105560987654',
    email: 'hello@amphitheatre.film',
    phone: '+66 81 234 5678',
    logo_url: null,
    is_default: true,
  },
];

const HEADER_THEMES = [
  { id: 'minimal',   label: 'Minimal',   headerBg: '#ffffff', headerText: '#111827', accentColor: '#111827' },
  { id: 'dark',      label: 'Dark',      headerBg: '#0a0a0d', headerText: '#f5f5f5', accentColor: '#a78bfa' },
  { id: 'ocean',     label: 'Ocean',     headerBg: '#0c4a6e', headerText: '#e0f2fe', accentColor: '#38bdf8' },
  { id: 'warm',      label: 'Warm',      headerBg: '#7c2d12', headerText: '#fed7aa', accentColor: '#fb923c' },
  { id: 'emerald',   label: 'Emerald',   headerBg: '#064e3b', headerText: '#d1fae5', accentColor: '#34d399' },
];

// ---------------------------------------------------------------------------
// Settings — main export
// ---------------------------------------------------------------------------

export default function Settings({ settings, onSaveSettings, clients = [], setClients, profiles = [], setProfiles }) {
  const [tab, setTab] = useState('profiles'); // profiles | clients | styling

  // Lifted state
  const [localProfiles, setLocalProfiles] = useState(profiles);
  const [localClients, setLocalClients] = useState(clients);
  const [localTheme, setLocalTheme] = useState(settings?.header_theme || 'minimal');

  const [initialStateStr, setInitialStateStr] = useState(() => JSON.stringify({ localProfiles: profiles, localClients: clients, localTheme: settings?.header_theme || 'minimal' }));
  const currentStateStr = JSON.stringify({ localProfiles, localClients, localTheme });
  const isDirty = currentStateStr !== initialStateStr;
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      if (onSaveSettings) await onSaveSettings({ header_theme: localTheme });

      // Upsert current profiles
      for (const p of localProfiles) {
        // Strip temp ID if it's not a real UUID to let Supabase create one, but our API uses UUID crypto.randomUUID()
        await upsertProfile(p);
      }
      // Delete removed profiles
      const profileIds = new Set(localProfiles.map(p => p.id));
      for (const p of profiles) {
        if (!profileIds.has(p.id)) await deleteProfile(p.id);
      }
      if (setProfiles) setProfiles(localProfiles);

      // Upsert current clients
      for (const c of localClients) {
        await upsertClient(c);
      }
      // Delete removed clients
      const clientIds = new Set(localClients.map(c => c.id));
      for (const c of clients) {
        if (!clientIds.has(c.id)) await deleteClient(c.id);
      }
      if (setClients) setClients(localClients);

      setInitialStateStr(JSON.stringify({ localProfiles, localClients, localTheme }));
    } catch (err) {
      console.error(err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors';
  const labelCls = 'block text-[10px] tracking-widest2 uppercase text-white/40 mb-1';

  const tabs = [
    { id: 'profiles', label: 'My Profiles', icon: User },
    { id: 'clients',  label: 'Clients',     icon: Building2 },
    { id: 'styling',  label: 'Doc Styling',  icon: Palette },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm tracking-widest2 uppercase text-white/85">Settings</h2>
          <p className="text-[10px] text-white/40 mt-0.5">Profiles · Clients · Document Styling</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] transition-colors ${
            isDirty 
              ? 'border-blue-500 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]' 
              : 'border-white/10 text-white/40'
          }`}
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {isSaving ? 'Saving...' : (isDirty ? 'Save Changes' : 'Saved')}
        </button>
      </header>

      {/* Tab bar */}
      <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-white/5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] transition-colors',
              tab === id ? 'bg-white/10 text-white border border-white/20' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent',
            ].join(' ')}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pretty-scroll">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          <AnimatePresence mode="wait">
            {tab === 'profiles' && (
              <motion.div key="profiles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <ProfilesTab profiles={localProfiles} setProfiles={setLocalProfiles} inputCls={inputCls} labelCls={labelCls} />
              </motion.div>
            )}
            {tab === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <ClientsTab localClients={localClients} setLocalClients={setLocalClients} inputCls={inputCls} labelCls={labelCls} />
              </motion.div>
            )}
            {tab === 'styling' && (
              <motion.div key="styling" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <StylingTab selectedTheme={localTheme} setSelectedTheme={setLocalTheme} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfilesTab — Issuer info + logo
// ---------------------------------------------------------------------------

function ProfilesTab({ profiles, setProfiles, inputCls, labelCls }) {
  const [editing, setEditing] = useState(null);

  const updateField = (id, key, val) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: val } : p)));
  };

  const addProfile = () => {
    const newP = {
      id: crypto.randomUUID(),
      company_name: '',
      address: '',
      tax_id: '',
      email: '',
      phone: '',
      logo_url: null,
      seller_name: '',
      signature_url: null,
      bank_details: '',
      terms_conditions: '',
      is_default: profiles.length === 0,
    };
    setProfiles((prev) => [...prev, newP]);
    setEditing(newP.id);
  };

  const removeProfile = (id) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const setAsDefault = (id) => {
    setProfiles((prev) => prev.map((p) => ({
      ...p,
      is_default: p.id === id
    })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/60">Issuer profiles appear as the "From" section on documents.</p>
        <button onClick={addProfile} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-[11px] font-medium">
          <Plus className="w-3 h-3" /> Add Profile
        </button>
      </div>
      {profiles.map((p) => (
        <div key={p.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover rounded-lg" /> : <Building2 className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm text-white">{p.company_name || 'New Profile'}</p>
                {p.is_default && <span className="text-[9px] tracking-widest2 uppercase text-emerald-400">Default</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!p.is_default && (
                <button onClick={() => setAsDefault(p.id)} className="text-[10px] tracking-widest2 uppercase px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors mr-2">
                  Make Default
                </button>
              )}
              <button onClick={() => setEditing(editing === p.id ? null : p.id)} className="text-white/40 hover:text-white">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeProfile(p.id)} className="text-white/20 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {editing === p.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-2.5 overflow-hidden">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Company Name</label>
                  <input value={p.company_name} onChange={(e) => updateField(p.id, 'company_name', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tax ID</label>
                  <input value={p.tax_id} onChange={(e) => updateField(p.id, 'tax_id', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={p.address} onChange={(e) => updateField(p.id, 'address', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={p.email} onChange={(e) => updateField(p.id, 'email', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={p.phone} onChange={(e) => updateField(p.id, 'phone', e.target.value)} className={inputCls} />
                </div>
              </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Seller Full Name (for Signature)</label>
                  <input value={p.seller_name || ''} onChange={(e) => updateField(p.id, 'seller_name', e.target.value)} className={inputCls} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className={labelCls}>Signature Image</label>
                  {p.signature_url ? (
                    <div className="relative w-full h-[38px] bg-white/5 border border-white/10 rounded-md flex items-center justify-between px-3">
                      <span className="text-xs text-white/70 truncate">Signature uploaded</span>
                      <button onClick={() => updateField(p.id, 'signature_url', null)} className="text-white/40 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-[38px] bg-white/5 border border-white/10 border-dashed rounded-md flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-[11px] text-white/50">Upload Signature</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await uploadPOFile(file);
                            updateField(p.id, 'signature_url', url);
                          } catch (err) { alert('Upload failed'); }
                        }
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Bank Transfer Details</label>
                <textarea rows={2} value={p.bank_details || ''} onChange={(e) => updateField(p.id, 'bank_details', e.target.value)} className={inputCls} placeholder="e.g. SCB 123-456-789 Name: John Doe" />
              </div>
              <div>
                <label className={labelCls}>Term of Conditions</label>
                <textarea rows={3} value={p.terms_conditions || ''} onChange={(e) => updateField(p.id, 'terms_conditions', e.target.value)} className={inputCls} placeholder="1. สินค้าหรือบริการในรายการนี้ไม่รับคืน...&#10;2. กรุณาชำระเงินภายใน 30 วัน..." />
              </div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClientsTab — full CRUD table
// ---------------------------------------------------------------------------

function ClientsTab({ localClients, setLocalClients, inputCls, labelCls }) {
  const [editingId, setEditingId] = useState(null);

  const updateField = (id, key, val) => {
    setLocalClients((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)));
  };

  const addClient = () => {
    const nc = { id: crypto.randomUUID(), company_name: '', address: '', tax_id: '' };
    setLocalClients((prev) => [...prev, nc]);
    setEditingId(nc.id);
  };

  const removeClient = (id) => {
    setLocalClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/60">{localClients.length} client{localClients.length !== 1 ? 's' : ''} registered</p>
        <button onClick={addClient} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-[11px] font-medium">
          <Plus className="w-3 h-3" /> Add Client
        </button>
      </div>
      {localClients.map((c) => (
        <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white truncate">{c.company_name || '(Unnamed)'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setEditingId(editingId === c.id ? null : c.id)} className="text-white/40 hover:text-white"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => removeClient(c.id)} className="text-white/20 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          {editingId === c.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
              <div>
                <label className={labelCls}>Company Name</label>
                <input value={c.company_name} onChange={(e) => updateField(c.id, 'company_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={c.address} onChange={(e) => updateField(c.id, 'address', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tax ID</label>
                <input value={c.tax_id} onChange={(e) => updateField(c.id, 'tax_id', e.target.value)} className={inputCls} />
              </div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StylingTab — header theme picker
// ---------------------------------------------------------------------------

function StylingTab({ selectedTheme, setSelectedTheme }) {
  const applyTheme = (themeId) => {
    setSelectedTheme(themeId);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/60">Choose a header style for your exported documents.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {HEADER_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => applyTheme(theme.id)}
            className={[
              'relative rounded-lg border overflow-hidden transition-all',
              selectedTheme === theme.id ? 'border-white/40 ring-1 ring-white/20' : 'border-white/10 hover:border-white/25',
            ].join(' ')}
          >
            {/* Mini preview */}
            <div className="aspect-[1/0.6] flex flex-col">
              <div className="h-[35%] flex items-center justify-between px-3" style={{ backgroundColor: theme.headerBg }}>
                <span className="text-[8px] font-bold tracking-tight" style={{ color: theme.headerText }}>AMPHITHEATRE</span>
                <span className="text-[6px] font-medium" style={{ color: theme.accentColor }}>QT</span>
              </div>
              <div className="flex-1 bg-white p-2">
                <div className="space-y-0.5">
                  <div className="h-1 w-3/4 rounded-full bg-gray-200" />
                  <div className="h-1 w-1/2 rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-white/70">{theme.label}</span>
              {selectedTheme === theme.id && <Check className="w-3 h-3 text-emerald-400" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
