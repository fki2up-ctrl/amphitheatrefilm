// ---------------------------------------------------------------------------
// theatreAlpha.js — Supabase data layer for the Theatre Alpha module.
//
// All functions assume the user is authenticated; RLS enforces per-user
// isolation, so we never need to send user_id from the client (the policies
// reject anything that doesn't match auth.uid()). We DO write user_id on
// insert because RLS check requires it.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

const TABLE_JOBS     = 'theatre_alpha_jobs';
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

// --- Jobs ------------------------------------------------------------------

export async function listJobs() {
  const { data, error } = await supabase
    .from(TABLE_JOBS)
    .select('*')
    .order('start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createJob(input) {
  const user_id = await requireUserId();
  const row = {
    user_id,
    title:              input.title?.trim() || 'Untitled job',
    client:             input.client?.trim() || null,
    start_at:           input.start_at,
    end_at:             input.end_at,
    amount:             Number(input.amount) || 0,
    billing_cycle_days: Number(input.billing_cycle_days) || 30,
    payment_status:     input.payment_status || 'unpaid',
    paid_at:            input.paid_at || null,
    notes:              input.notes || null,
  };
  const { data, error } = await supabase
    .from(TABLE_JOBS).insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateJob(id, patch) {
  const { data, error } = await supabase
    .from(TABLE_JOBS).update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteJob(id) {
  const { error } = await supabase.from(TABLE_JOBS).delete().eq('id', id);
  if (error) throw error;
}

// --- Settings --------------------------------------------------------------

export async function getSettings() {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from(TABLE_SETTINGS).select('*').eq('user_id', user_id).maybeSingle();
  if (error) throw error;
  return data || { user_id, ...SETTINGS_DEFAULTS };
}

export async function upsertSettings(patch) {
  const user_id = await requireUserId();
  const row = { user_id, ...SETTINGS_DEFAULTS, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from(TABLE_SETTINGS)
    .upsert(row, { onConflict: 'user_id' })
    .select('*').single();
  if (error) throw error;
  return data;
}
