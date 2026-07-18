// ---------------------------------------------------------------------------
// theatreAlpha.js — Supabase data layer for the Theatre Alpha module.
//
// Uses the new separated SQL tables for Profiles, Clients, and Quotations.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

// --- Profiles --------------------------------------------------------------

export async function getProfiles() {
  const { data, error } = await supabase.from('alpha_profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertProfile(profile) {
  const { data, error } = await supabase.from('alpha_profiles').upsert(profile).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id) {
  const { error } = await supabase.from('alpha_profiles').delete().eq('id', id);
  if (error) throw error;
}

// --- Clients ---------------------------------------------------------------

export async function getClients() {
  const { data, error } = await supabase.from('alpha_clients').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertClient(client) {
  const { data, error } = await supabase.from('alpha_clients').upsert(client).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id) {
  const { error } = await supabase.from('alpha_clients').delete().eq('id', id);
  if (error) throw error;
}

// --- Quotations (Jobs) -----------------------------------------------------

export async function listJobs() {
  const { data, error } = await supabase
    .from('doc_quotations')
    .select(`
      *,
      doc_line_items (*),
      doc_expenses (*)
    `)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createJob(input) {
  const row = {
    qt_number:          input.qt_number || `QT-${Date.now()}`,
    project_name:       input.project_name || input.title || 'Untitled job',
    client_id:          input.client_id || null,
    start_at:           input.start_at,
    end_at:             input.end_at,
    status:             input.status || input.payment_status || 'draft',
    notes:              input.notes || null,
    discount_pct:       input.discount_pct || 0,
    vat_pct:            input.vat_pct !== undefined ? input.vat_pct : 7,
    wht_pct:            input.wht_pct || 0,
  };
  const { data, error } = await supabase
    .from('doc_quotations')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return { ...data, doc_line_items: [], doc_expenses: [] };
}

export async function updateJob(id, patch, lineItems = null, expenses = null) {
  // Update quotation core fields
  if (Object.keys(patch).length > 0) {
    const cleanPatch = { ...patch };
    if (cleanPatch.client_id === '') cleanPatch.client_id = null;
    
    const { error } = await supabase
      .from('doc_quotations')
      .update(cleanPatch)
      .eq('id', id);
    if (error) throw error;
  }

  // Sync line items (Delete and insert)
  if (lineItems) {
    await supabase.from('doc_line_items').delete().eq('quotation_id', id);
    if (lineItems.length > 0) {
      const itemsToInsert = lineItems.map(li => ({
        quotation_id: id,
        description: li.description || '',
        qty: Number(li.qty !== undefined ? li.qty : (li.quantity || 1)) || 0,
        unit_price: Number(li.unit_price !== undefined ? li.unit_price : (li.price_per_unit || 0)) || 0,
        unit_name: li.unit_name || ''
      }));
      await supabase.from('doc_line_items').insert(itemsToInsert);
    }
  }

  // Sync expenses (Delete and insert)
  if (expenses) {
    await supabase.from('doc_expenses').delete().eq('quotation_id', id);
    if (expenses.length > 0) {
      const expensesToInsert = expenses.map(ex => ({
        quotation_id: id,
        category: ex.category || ex.type || '',
        description: ex.description || ex.expense_name || ex.label || '',
        amount: Number(ex.amount !== undefined ? ex.amount : ex.value) || 0,
        expense_date: ex.expense_date || ex.date || null,
        is_paid: ex.is_paid || ex.paid || false,
        x: Number(ex.x) || 0,
        y: Number(ex.y) || 0
      }));
      await supabase.from('doc_expenses').insert(expensesToInsert);
    }
  }

  // Return fresh data
  const { data, error: fetchError } = await supabase
    .from('doc_quotations')
    .select(`*, doc_line_items (*), doc_expenses (*)`)
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  return data;
}

export async function deleteJob(id) {
  const { error } = await supabase.from('doc_quotations').delete().eq('id', id);
  if (error) throw error;
}

// --- Settings --------------------------------------------------------------
const TABLE_SETTINGS = 'theatre_alpha_settings';
const SETTINGS_DEFAULTS = {
  currency_code:   'THB',
  currency_symbol: '฿',
  tax_rate_pct:    3,
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}

export async function getSettings() {
  try {
    const user_id = await requireUserId();
    const { data, error } = await supabase
      .from(TABLE_SETTINGS).select('*').eq('user_id', user_id).maybeSingle();
    if (error) throw error;
    return data || { user_id, ...SETTINGS_DEFAULTS };
  } catch(e) {
    // If not using auth, fallback to local settings
    return SETTINGS_DEFAULTS;
  }
}

export async function upsertSettings(patch) {
  try {
    const user_id = await requireUserId();
    const row = { user_id, ...SETTINGS_DEFAULTS, ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from(TABLE_SETTINGS)
      .upsert(row, { onConflict: 'user_id' })
      .select('*').single();
    if (error) throw error;
    return data;
  } catch(e) {
    return patch; // fallback
  }
}
