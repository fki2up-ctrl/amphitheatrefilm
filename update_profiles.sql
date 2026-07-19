ALTER TABLE public.alpha_profiles ADD COLUMN IF NOT EXISTS seller_name text;
ALTER TABLE public.alpha_profiles ADD COLUMN IF NOT EXISTS signature_url text;
ALTER TABLE public.alpha_profiles ADD COLUMN IF NOT EXISTS bank_details text;
