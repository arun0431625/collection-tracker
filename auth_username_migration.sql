-- 1. Add username column and backfill it
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE public.branches 
SET username = branch_code 
WHERE username IS NULL;

-- Make username unique and required
ALTER TABLE public.branches ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.branches ADD CONSTRAINT unique_branch_username UNIQUE (username);

-- 2. Update branch_email to map from username instead of branch_code
CREATE OR REPLACE FUNCTION public.branch_email(p_identifier text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(p_identifier)) || '@tracker.com';
$$;

-- 3. Update get_current_branch_profile to match by username
CREATE OR REPLACE FUNCTION public.get_current_branch_profile()
RETURNS table (
  branch_code text,
  branch_name text,
  area_manager text,
  role text,
  username text,
  must_change_password boolean,
  is_active boolean,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    b.branch_code,
    b.branch_name,
    b.area_manager,
    b.role,
    b.username,
    COALESCE(b.must_change_password, false) as must_change_password,
    COALESCE(b.is_active, false) as is_active,
    u.email
  FROM public.branches b
  JOIN auth.users u
    ON lower(u.email) = public.branch_email(b.username)
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

-- 4. Update is_current_admin to map by username
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branches b
    JOIN auth.users u
      ON lower(u.email) = public.branch_email(b.username)
    WHERE u.id = auth.uid()
      AND upper(COALESCE(b.role, '')) = 'ADMIN'
      AND COALESCE(b.is_active, false) = true
  );
$$;

-- 5. Update branch_complete_password_change
CREATE OR REPLACE FUNCTION public.branch_complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_email text;
BEGIN
  SELECT email INTO current_email
  FROM auth.users
  WHERE id = auth.uid();

  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.branches
  SET
    must_change_password = false,
    password_changed_at = now()
  WHERE public.branch_email(username) = lower(current_email);
END;
$$;

-- 6. Update Admin Delete (fetch by branch_code but delete user by username mapping)
CREATE OR REPLACE FUNCTION public.admin_delete_branch(p_branch_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_username text;
  target_email text;
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can delete branches';
  END IF;

  IF upper(trim(p_branch_code)) = 'ADMIN' THEN
    RAISE EXCEPTION 'Admin branch cannot be deleted';
  END IF;

  SELECT username INTO target_username 
  FROM public.branches 
  WHERE upper(branch_code) = upper(trim(p_branch_code));

  IF target_username IS NULL THEN
     RAISE EXCEPTION 'Branch not found';
  END IF;

  target_email := public.branch_email(target_username);

  DELETE FROM public.collections_lrs
  WHERE upper(branch_code) = upper(trim(p_branch_code));

  DELETE FROM public.branches
  WHERE upper(branch_code) = upper(trim(p_branch_code));

  DELETE FROM auth.identities
  WHERE lower(provider_id) = lower(target_email);

  DELETE FROM auth.users
  WHERE lower(email) = lower(target_email);
END;
$$;

-- 7. Update Admin Reset Password (use username to reset the email)
CREATE OR REPLACE FUNCTION public.admin_reset_branch_password(p_branch_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_username text;
  target_email text;
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can reset branch passwords';
  END IF;

  IF upper(trim(p_branch_code)) = 'ADMIN' THEN
    RAISE EXCEPTION 'Admin password cannot be reset here';
  END IF;

  SELECT username INTO target_username 
  FROM public.branches 
  WHERE upper(branch_code) = upper(trim(p_branch_code));

  IF target_username IS NULL THEN
      RAISE EXCEPTION 'Branch not found';
  END IF;

  target_email := public.branch_email(target_username);

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt('Branch@123', extensions.gen_salt('bf')),
    updated_at = now()
  WHERE lower(email) = lower(target_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found for branch %', p_branch_code;
  END IF;

  UPDATE public.branches
  SET
    must_change_password = true,
    password_changed_at = null
  WHERE upper(branch_code) = upper(trim(p_branch_code));
END;
$$;

-- 8. Return username in admin_list_branch_security_rows
CREATE OR REPLACE FUNCTION public.admin_list_branch_security_rows()
RETURNS table (
  id text,
  branch_code text,
  area_manager text,
  is_active boolean,
  password_changed_at timestamptz,
  username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can view branch security rows';
  END IF;

  RETURN QUERY
  SELECT
    b.id::text,
    b.branch_code::text,
    b.area_manager::text,
    COALESCE(b.is_active, false)::boolean as is_active,
    b.password_changed_at::timestamptz,
    b.username::text
  FROM public.branches b
  ORDER BY b.branch_code;
END;
$$;

-- 9. Update admin_insert_collections_lrs to set username on auto-creation
CREATE OR REPLACE FUNCTION public.admin_insert_collections_lrs(p_rows jsonb)
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
    RAISE EXCEPTION 'Only admin can insert collections';
  END IF;

  FOR branch_rec IN
    SELECT DISTINCT upper(trim(x.branch_code)) as bc, x.area_manager as am
    FROM jsonb_to_recordset(p_rows) as x(branch_code text, area_manager text)
    WHERE upper(trim(x.branch_code)) <> ''
  LOOP
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

  INSERT INTO public.collections_lrs (
    area_manager, branch_code, gr_no, gr_date, party_name, total_freight, pay_mode
  )
  SELECT
    x.area_manager, upper(trim(x.branch_code)), trim(x.gr_no), x.gr_date, x.party_name, coalesce(x.total_freight, 0), x.pay_mode
  FROM jsonb_to_recordset(p_rows) as x(
    area_manager text, branch_code text, gr_no text, gr_date date, party_name text, total_freight numeric, pay_mode text
  )
  ON CONFLICT (branch_code, gr_no) DO UPDATE
  SET
    area_manager = EXCLUDED.area_manager,
    gr_date = EXCLUDED.gr_date,
    party_name = EXCLUDED.party_name,
    total_freight = EXCLUDED.total_freight,
    pay_mode = EXCLUDED.pay_mode;
END;
$$;

-- 10. RPC to Change the Username manually
CREATE OR REPLACE FUNCTION public.admin_change_branch_username(p_branch_code text, p_new_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_old_email text;
  v_new_email text;
  v_old_username text;
  v_clean_new_username text;
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can change usernames';
  END IF;

  v_clean_new_username := upper(trim(p_new_username));

  IF v_clean_new_username = '' THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;

  -- Ensure it's not taken by another branch
  IF EXISTS (SELECT 1 FROM public.branches WHERE username = v_clean_new_username AND branch_code != upper(trim(p_branch_code))) THEN
    RAISE EXCEPTION 'Username "%" is already taken', v_clean_new_username;
  END IF;

  SELECT username INTO v_old_username
  FROM public.branches
  WHERE branch_code = upper(trim(p_branch_code));

  IF v_old_username IS NULL THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  -- Don't do anything if they match
  IF v_old_username = v_clean_new_username THEN
    RETURN;
  END IF;

  v_old_email := public.branch_email(v_old_username);
  v_new_email := public.branch_email(v_clean_new_username);

  -- 1. Grab user_id from auth.users using old email
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_old_email);

  -- 2. Update branches table (this must not fail because auth will drift)
  UPDATE public.branches 
  SET username = v_clean_new_username
  WHERE branch_code = upper(trim(p_branch_code));

  IF v_user_id IS NOT NULL THEN
    -- 3. Update auth.identities
    UPDATE auth.identities
    SET provider_id = v_new_email,
        identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new_email))
    WHERE user_id = v_user_id;

    -- 4. Update auth.users
    UPDATE auth.users
    SET email = v_new_email
    WHERE id = v_user_id;
  END IF;
END;
$$;
