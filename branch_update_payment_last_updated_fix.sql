-- Run this in Supabase SQL Editor.
-- It makes branch payment saves stamp the real save time,
-- so Branch Activity Monitor shows the latest update date correctly.

CREATE OR REPLACE FUNCTION public.branch_update_collection_payment(
  p_gr_no text,
  p_branch_code text,
  p_payment_mode text,
  p_received_amount numeric,
  p_payment_date date,
  p_ref_no text,
  p_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  current_profile record;
BEGIN
  SELECT * INTO current_profile
  FROM public.get_current_branch_profile();

  IF current_profile IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF upper(coalesce(current_profile.role, '')) <> 'ADMIN'
    AND upper(coalesce(current_profile.branch_code, '')) <> upper(trim(p_branch_code)) THEN
    RAISE EXCEPTION 'Not allowed to update another branch';
  END IF;

  UPDATE public.collections_lrs
  SET
    payment_mode = p_payment_mode,
    received_amount = p_received_amount,
    payment_date = p_payment_date,
    ref_no = p_ref_no,
    remarks = p_remarks,
    last_updated = now()
  WHERE gr_no = p_gr_no
    AND upper(branch_code) = upper(trim(p_branch_code));
END;
$function$;
