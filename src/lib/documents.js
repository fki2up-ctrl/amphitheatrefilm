// ---------------------------------------------------------------------------
// documents.js — Supabase data layer for the AlphaProd Documents module.
//
// Tables: ap_clients, ap_projects, ap_line_items, ap_expenses
// All functions assume the user is authenticated; RLS enforces isolation.
// ---------------------------------------------------------------------------

import { supabase, hasSupabase } from './supabase';

// ---------------------------------------------------------------------------
// QT Number Generator
// Format: QT[YYMMDD]-[3-digit sequence per client]
// e.g. QT260714-001, QT260714-002
// Sequence is scoped to the client — each client gets its own counter.
// ---------------------------------------------------------------------------

export function generateQtNumber(clientSequenceId = 1, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const seq = String(clientSequenceId).padStart(3, '0');
  return `QT${yy}${mm}${dd}-${seq}`;
}

// ---------------------------------------------------------------------------
// Auth helper (mirrors theatreAlpha.js pattern)
// ---------------------------------------------------------------------------

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const T_CLIENTS = 'ap_clients';

export async function listClients() {
  const { data, error } = await supabase
    .from(T_CLIENTS).select('*').order('company_name');
  if (error) throw error;
  return data || [];
}

export async function createClient(input) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from(T_CLIENTS)
    .insert({ user_id, ...input })
    .select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Projects (Quotations)
// ---------------------------------------------------------------------------

const T_PROJECTS = 'ap_projects';

export async function listProjects() {
  const { data, error } = await supabase
    .from(T_PROJECTS)
    .select('*, client:ap_clients(*), line_items:ap_line_items(*), expenses:ap_expenses(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProject(input) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from(T_PROJECTS)
    .insert({ user_id, ...input })
    .select('*').single();
  if (error) throw error;
  return data;
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase
    .from(T_PROJECTS).update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from(T_PROJECTS).delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Line Items
// ---------------------------------------------------------------------------

const T_LINE_ITEMS = 'ap_line_items';

export async function upsertLineItems(projectId, items) {
  // Delete existing, then bulk-insert — simplest for reordering support.
  await supabase.from(T_LINE_ITEMS).delete().eq('project_id', projectId);
  if (items.length === 0) return [];
  const rows = items.map((it, i) => ({
    project_id: projectId,
    service_name: it.service_name,
    quantity: Number(it.quantity) || 1,
    price_per_unit: Number(it.price_per_unit) || 0,
    unit_name: it.unit_name || 'unit',
    sort_order: i,
  }));
  const { data, error } = await supabase
    .from(T_LINE_ITEMS).insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const T_EXPENSES = 'ap_expenses';

export async function upsertExpenses(projectId, items) {
  await supabase.from(T_EXPENSES).delete().eq('project_id', projectId);
  if (items.length === 0) return [];
  const rows = items.map((it) => ({
    project_id: projectId,
    expense_name: it.expense_name,
    amount: Number(it.amount) || 0,
    date: it.date || new Date().toISOString().slice(0, 10),
  }));
  const { data, error } = await supabase
    .from(T_EXPENSES).insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// B2 file upload for PO documents
// Mirrors the pattern in b2Upload.js — requests a presigned URL via Supabase
// Edge Function, then PUTs the file directly to B2/S3.
// ---------------------------------------------------------------------------

export async function uploadPOFile(file, onProgress = () => {}) {
  if (!file) throw new Error('No file selected.');
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File too large (max 50 MB).');
  }

  if (!hasSupabase) {
    // Local dev simulation — return a mock URL after a fake delay.
    return new Promise((resolve) => {
      let pct = 0;
      const iv = setInterval(() => {
        pct = Math.min(pct + 20, 100);
        onProgress(pct);
        if (pct >= 100) {
          clearInterval(iv);
          resolve({
            url: `https://b2-mock.local/alphaprod/po/${file.name}`,
            fileName: file.name,
            bytes: file.size,
          });
        }
      }, 200);
    });
  }

  const { default: axios } = await import('axios');

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sign in to upload files.');

  const sanitized = file.name.replace(/[^A-Za-z0-9._-]/g, '-');
  const key = `alphaprod/po/${Date.now()}-${sanitized}`;

  const { data, error } = await supabase.functions.invoke('get-b2-upload-url', {
    body: { fileName: key, contentType: file.type || 'application/pdf' },
  });
  if (error) throw new Error(error.message || 'Edge function failed.');
  if (!data?.uploadUrl) throw new Error('Invalid upload credentials.');

  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/pdf' },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
    timeout: 0,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return {
    url: data.publicUrl,
    fileName: file.name,
    bytes: file.size,
  };
}
