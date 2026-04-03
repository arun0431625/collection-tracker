  create extension if not exists pgcrypto;

  create or replace function public.branch_email(p_branch_code text)
  returns text
  language sql
  immutable
  as $$
    select lower(trim(p_branch_code)) || '@tracker.com';
  $$;

  create or replace function public.get_current_branch_profile()
  returns table (
    branch_code text,
    branch_name text,
    area_manager text,
    role text,
    username text,
    must_change_password boolean,
    is_active boolean,
    email text
  )
  language sql
  security definer
  set search_path = public, auth
  as $$
    select
      b.branch_code,
      b.branch_name,
      b.area_manager,
      b.role,
      b.branch_code as username,
      coalesce(b.must_change_password, false) as must_change_password,
      coalesce(b.is_active, false) as is_active,
      u.email
    from public.branches b
    join auth.users u
      on lower(u.email) = public.branch_email(b.branch_code)
    where u.id = auth.uid()
    limit 1;
  $$;

  create or replace function public.is_current_admin()
  returns boolean
  language sql
  security definer
  set search_path = public, auth
  as $$
    select exists (
      select 1
      from public.branches b
      join auth.users u
        on lower(u.email) = public.branch_email(b.branch_code)
      where u.id = auth.uid()
        and upper(coalesce(b.role, '')) = 'ADMIN'
        and coalesce(b.is_active, false) = true
    );
  $$;

  create or replace function public.branch_complete_password_change()
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    current_email text;
  begin
    select email into current_email
    from auth.users
    where id = auth.uid();

    if current_email is null then
      raise exception 'Not authenticated';
    end if;

    update public.branches
    set
      must_change_password = false,
      password_changed_at = now()
    where public.branch_email(branch_code) = lower(current_email);
  end;
  $$;

  create or replace function public.admin_reset_branch_password(p_branch_code text)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    target_email text := public.branch_email(p_branch_code);
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can reset branch passwords';
    end if;

    if upper(trim(p_branch_code)) = 'ADMIN' then
      raise exception 'Admin password cannot be reset here';
    end if;

    update auth.users
    set
      encrypted_password = extensions.crypt('Branch@123', extensions.gen_salt('bf')),
      updated_at = now()
    where lower(email) = target_email;

    if not found then
      raise exception 'Auth user not found for branch %', p_branch_code;
    end if;

    update public.branches
    set
      must_change_password = true,
      password_changed_at = null
    where upper(branch_code) = upper(trim(p_branch_code));
  end;
  $$;

  create or replace function public.admin_set_branch_active(
    p_branch_code text,
    p_is_active boolean
  )
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can update branch status';
    end if;

    update public.branches
    set is_active = p_is_active
    where upper(branch_code) = upper(trim(p_branch_code));
  end;
  $$;

  create or replace function public.admin_delete_branch(p_branch_code text)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    target_email text := public.branch_email(p_branch_code);
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can delete branches';
    end if;

    if upper(trim(p_branch_code)) = 'ADMIN' then
      raise exception 'Admin branch cannot be deleted';
    end if;

    delete from public.collections_lrs
    where upper(branch_code) = upper(trim(p_branch_code));

    delete from public.branches
    where upper(branch_code) = upper(trim(p_branch_code));

    delete from auth.identities
    where lower(provider_id) = target_email;

    delete from auth.users
    where lower(email) = target_email;
  end;
  $$;

  create or replace function public.branch_update_collection_payment(
    p_gr_no text,
    p_branch_code text,
    p_payment_mode text,
    p_received_amount numeric,
    p_payment_date date,
    p_ref_no text,
    p_remarks text
  )
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    current_profile record;
  begin
    select * into current_profile
    from public.get_current_branch_profile();

    if current_profile is null then
      raise exception 'Not authenticated';
    end if;

    if upper(coalesce(current_profile.role, '')) <> 'ADMIN'
      and upper(coalesce(current_profile.branch_code, '')) <> upper(trim(p_branch_code)) then
      raise exception 'Not allowed to update another branch';
    end if;

    update public.collections_lrs
    set
      payment_mode = p_payment_mode,
      received_amount = p_received_amount,
      payment_date = p_payment_date,
      ref_no = p_ref_no,
      remarks = p_remarks
    where gr_no = p_gr_no
      and upper(branch_code) = upper(trim(p_branch_code));
  end;
  $$;

  create or replace function public.admin_insert_collections_lrs(p_rows jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    branch_rec record;
    new_user_id uuid;
    target_email text;
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can insert collections';
    end if;

    -- Auto-create branches for any new branch_code in the upload
    for branch_rec in
      select distinct upper(trim(x.branch_code)) as bc, x.area_manager as am
      from jsonb_to_recordset(p_rows) as x(branch_code text, area_manager text)
      where upper(trim(x.branch_code)) <> ''
    loop
      -- Create branch row if not exists
      insert into public.branches (id, branch_code, branch_name, area_manager, role, is_active, must_change_password, password_hash)
      values (gen_random_uuid(), branch_rec.bc, branch_rec.bc, branch_rec.am, 'BRANCH', true, true, 'legacy_auth_removed')
      on conflict (branch_code) do update set area_manager = excluded.area_manager;

      -- Create auth user if not exists
      target_email := public.branch_email(branch_rec.bc);
      if not exists (select 1 from auth.users where lower(email) = target_email) then
        new_user_id := gen_random_uuid();
        insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
        values ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', target_email, extensions.crypt('Branch@123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
        insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', target_email), 'email', target_email, now(), now(), now());
      end if;
    end loop;

    -- Insert collection data
    insert into public.collections_lrs (
      area_manager, branch_code, gr_no, gr_date, party_name, total_freight, pay_mode
    )
    select distinct on (upper(x.branch_code), x.gr_no)
      x.area_manager, upper(x.branch_code), x.gr_no, x.gr_date, x.party_name, x.total_freight, x.pay_mode
    from jsonb_to_recordset(p_rows) as x(
      area_manager text, branch_code text, gr_no text, gr_date date, party_name text, total_freight numeric, pay_mode text
    )
    order by upper(x.branch_code), x.gr_no
    on conflict (branch_code, gr_no) do nothing;
  end;
  $$;

  create or replace function public.admin_upsert_collections_lrs(p_rows jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    branch_rec record;
    new_user_id uuid;
    target_email text;
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can upsert collections';
    end if;

    -- Auto-create branches for any new branch_code in the upload
    for branch_rec in
      select distinct upper(trim(x.branch_code)) as bc, x.area_manager as am
      from jsonb_to_recordset(p_rows) as x(branch_code text, area_manager text)
      where upper(trim(x.branch_code)) <> ''
    loop
      insert into public.branches (id, branch_code, branch_name, area_manager, role, is_active, must_change_password, password_hash)
      values (gen_random_uuid(), branch_rec.bc, branch_rec.bc, branch_rec.am, 'BRANCH', true, true, 'legacy_auth_removed')
      on conflict (branch_code) do update set area_manager = excluded.area_manager;

      target_email := public.branch_email(branch_rec.bc);
      if not exists (select 1 from auth.users where lower(email) = target_email) then
        new_user_id := gen_random_uuid();
        insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
        values ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', target_email, extensions.crypt('Branch@123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
        insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', target_email), 'email', target_email, now(), now(), now());
      end if;
    end loop;

    -- Upsert collection data
    insert into public.collections_lrs (
      area_manager, branch_code, gr_no, gr_date, party_name, total_freight, pay_mode
    )
    select distinct on (upper(x.branch_code), x.gr_no)
      x.area_manager, upper(x.branch_code), x.gr_no, x.gr_date, x.party_name, x.total_freight, x.pay_mode
    from jsonb_to_recordset(p_rows) as x(
      area_manager text, branch_code text, gr_no text, gr_date date, party_name text, total_freight numeric, pay_mode text
    )
    order by upper(x.branch_code), x.gr_no
    on conflict (branch_code, gr_no) do update
    set
      area_manager = excluded.area_manager,
      gr_date = excluded.gr_date,
      party_name = excluded.party_name,
      total_freight = excluded.total_freight,
      pay_mode = excluded.pay_mode;
  end;
  $$;

  create or replace function public.admin_update_collection_fields(p_rows jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can update collection fields';
    end if;

    update public.collections_lrs as target
    set
      payment_mode = source.payment_mode,
      received_amount = source.received_amount,
      payment_date = source.payment_date,
      ref_no = source.ref_no,
      remarks = source.remarks
    from jsonb_to_recordset(p_rows) as source(
      branch_code text,
      gr_no text,
      payment_mode text,
      received_amount numeric,
      payment_date date,
      ref_no text,
      remarks text
    )
    where upper(target.branch_code) = upper(source.branch_code)
      and target.gr_no = source.gr_no;
  end;
  $$;

  create or replace function public.admin_list_branch_security_rows()
  returns table (
    id text,
    branch_code text,
    area_manager text,
    is_active boolean,
    password_changed_at timestamptz
  )
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can view branch security rows';
    end if;

    return query
    select
      b.id::text,
      b.branch_code::text,
      b.area_manager::text,
      coalesce(b.is_active, false)::boolean as is_active,
      b.password_changed_at::timestamptz
    from public.branches b
    order by b.branch_code;
  end;
  $$;

  create or replace function public.admin_get_branch_delete_summary(p_branch_code text)
  returns table (
    branch text,
    lr_count bigint,
    total_freight numeric,
    collected numeric,
    balance numeric
  )
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can view branch delete summary';
    end if;

    return query
    select
      upper(trim(p_branch_code)) as branch,
      count(*)::bigint as lr_count,
      coalesce(sum(c.total_freight), 0) as total_freight,
      coalesce(sum(least(coalesce(c.received_amount, 0), coalesce(c.total_freight, 0))), 0) as collected,
      coalesce(
        sum(
          coalesce(c.total_freight, 0)
          - least(coalesce(c.received_amount, 0), coalesce(c.total_freight, 0))
        ),
        0
      ) as balance
    from public.collections_lrs c
    where upper(c.branch_code) = upper(trim(p_branch_code));
  end;
  $$;

  create or replace function public.admin_get_existing_collection_rows(p_rows jsonb)
  returns table (
    branch_code text,
    gr_no text,
    total_freight numeric
  )
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  begin
    if not public.is_current_admin() then
      raise exception 'Only admin can view existing collection rows';
    end if;

    return query
    with requested as (
      select distinct
        upper(trim(x.branch_code)) as branch_code,
        trim(x.gr_no) as gr_no
      from jsonb_to_recordset(p_rows) as x(
        branch_code text,
        gr_no text
      )
    )
    select
      c.branch_code,
      c.gr_no,
      c.total_freight
    from public.collections_lrs c
    join requested r
      on upper(c.branch_code) = r.branch_code
    and c.gr_no = r.gr_no;
  end;
  $$;

  create or replace function public.get_accessible_collection_branch_codes()
  returns table (
    branch_code text
  )
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    current_profile record;
  begin
    select * into current_profile
    from public.get_current_branch_profile();

    if current_profile is null or not coalesce(current_profile.is_active, false) then
      raise exception 'Not authenticated';
    end if;

    if upper(coalesce(current_profile.role, '')) = 'ADMIN' then
      return query
      select distinct c.branch_code
      from public.collections_lrs c
      order by c.branch_code;
    end if;

    return query
    select upper(trim(current_profile.branch_code));
  end;
  $$;

  create or replace function public.admin_provision_branch_auth_users(
    p_temp_password text default 'Branch@123'
  )
  returns integer
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
  declare
    branch_row record;
    new_user_id uuid;
    created_count integer := 0;
    target_email text;
  begin
    for branch_row in
      select branch_code
      from public.branches
    loop
      target_email := public.branch_email(branch_row.branch_code);

      if not exists (
        select 1 from auth.users where lower(email) = target_email
      ) then
        new_user_id := gen_random_uuid();

        insert into auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          email_change,
          email_change_token_new,
          recovery_token
        )
        values (
          '00000000-0000-0000-0000-000000000000',
          new_user_id,
          'authenticated',
          'authenticated',
          target_email,
          extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}',
          '{}'::jsonb,
          now(),
          now(),
          '',
          '',
          '',
          ''
        );

        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        )
        values (
          gen_random_uuid(),
          new_user_id,
          jsonb_build_object('sub', new_user_id::text, 'email', target_email),
          'email',
          target_email,
          now(),
          now(),
          now()
        );

        created_count := created_count + 1;
      end if;
    end loop;

    return created_count;
  end;
  $$;

  grant execute on function public.get_current_branch_profile() to authenticated;
  grant execute on function public.branch_complete_password_change() to authenticated;
  grant execute on function public.admin_reset_branch_password(text) to authenticated;
  grant execute on function public.admin_set_branch_active(text, boolean) to authenticated;
  grant execute on function public.admin_delete_branch(text) to authenticated;
  grant execute on function public.branch_update_collection_payment(text, text, text, numeric, date, text, text) to authenticated;
  grant execute on function public.admin_insert_collections_lrs(jsonb) to authenticated;
  grant execute on function public.admin_upsert_collections_lrs(jsonb) to authenticated;
  grant execute on function public.admin_update_collection_fields(jsonb) to authenticated;
  grant execute on function public.admin_list_branch_security_rows() to authenticated;
  grant execute on function public.admin_get_branch_delete_summary(text) to authenticated;
  grant execute on function public.admin_get_existing_collection_rows(jsonb) to authenticated;
  grant execute on function public.get_accessible_collection_branch_codes() to authenticated;
