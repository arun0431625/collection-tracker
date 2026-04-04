-- Run this in your Supabase SQL Editor to fix the Admin Upload "null value in username" error
CREATE OR REPLACE FUNCTION public.admin_upsert_collections_lrs(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  branch_rec record;
  new_user_id uuid;
  target_email text;
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can upsert collections';
  END IF;

  -- Auto-create branches for any new branch_code in the upload
  FOR branch_rec IN
    SELECT DISTINCT upper(trim(x.branch_code)) as bc, x.area_manager as am
    FROM jsonb_to_recordset(p_rows) as x(branch_code text, area_manager text)
    WHERE upper(trim(x.branch_code)) <> ''
  LOOP
    -- Fix: Added "username" to the column list and provided "branch_rec.bc" as the value
    INSERT INTO public.branches (id, branch_code, branch_name, area_manager, role, is_active, must_change_password, password_hash, username)
    VALUES (gen_random_uuid(), branch_rec.bc, branch_rec.bc, branch_rec.am, 'BRANCH', true, true, 'legacy_auth_removed', branch_rec.bc)
    ON CONFLICT (branch_code) DO UPDATE SET area_manager = EXCLUDED.area_manager;

    target_email := public.branch_email(branch_rec.bc);
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = target_email) THEN
      new_user_id := gen_random_uuid();
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      VALUES ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', target_email, extensions.crypt('Branch@123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', target_email), 'email', target_email, now(), now(), now());
    END IF;
  END LOOP;

  -- Upsert collection data
  INSERT INTO public.collections_lrs (
    area_manager, branch_code, gr_no, gr_date, party_name, total_freight, pay_mode
  )
  SELECT DISTINCT ON (upper(x.branch_code), x.gr_no)
    x.area_manager, upper(x.branch_code), x.gr_no, x.gr_date, x.party_name, coalesce(x.total_freight, 0), x.pay_mode
  FROM jsonb_to_recordset(p_rows) as x(
    area_manager text, branch_code text, gr_no text, gr_date date, party_name text, total_freight numeric, pay_mode text
  )
  ORDER BY upper(x.branch_code), x.gr_no
  ON CONFLICT (branch_code, gr_no) DO UPDATE
  SET
    area_manager = EXCLUDED.area_manager,
    gr_date = EXCLUDED.gr_date,
    party_name = EXCLUDED.party_name,
    total_freight = EXCLUDED.total_freight,
    pay_mode = EXCLUDED.pay_mode;
END;
$$;
