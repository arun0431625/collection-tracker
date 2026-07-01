create table if not exists public.branch_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  gr_no text not null,
  from_branch_code text not null,
  to_branch_code text not null,
  requested_by uuid references auth.users(id),
  requested_at timestamp with time zone not null default now(),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by uuid references auth.users(id),
  decided_at timestamp with time zone,
  reject_reason text,
  constraint branch_transfer_request_no_self_transfer check (upper(from_branch_code) <> upper(to_branch_code))
);

create unique index if not exists branch_transfer_requests_one_pending
on public.branch_transfer_requests (from_branch_code, gr_no)
where status = 'PENDING';

create index if not exists idx_branch_transfer_requests_status_requested
on public.branch_transfer_requests (status, requested_at desc);

alter table public.branch_transfer_requests enable row level security;

drop policy if exists "branch transfer no direct read" on public.branch_transfer_requests;
create policy "branch transfer no direct read"
on public.branch_transfer_requests
for select
to authenticated
using (false);

drop policy if exists "branch transfer no direct writes" on public.branch_transfer_requests;
create policy "branch transfer no direct writes"
on public.branch_transfer_requests
for all
to authenticated
using (false)
with check (false);

create or replace function public.request_branch_transfer(
  p_gr_no text,
  p_from_branch_code text,
  p_to_branch_code text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_profile record;
  target_branch_exists boolean;
begin
  select * into current_profile
  from public.get_current_branch_profile();

  if current_profile is null then
    raise exception 'Not authenticated';
  end if;

  if upper(coalesce(current_profile.role, '')) <> 'BRANCH' then
    raise exception 'Only branch users can request transfer';
  end if;

  if upper(current_profile.branch_code) <> upper(trim(p_from_branch_code)) then
    raise exception 'You can only request transfer from your own branch';
  end if;

  if upper(trim(p_from_branch_code)) = upper(trim(p_to_branch_code)) then
    raise exception 'Select a different branch';
  end if;

  select exists (
    select 1
    from public.branches
    where upper(branch_code) = upper(trim(p_to_branch_code))
      and coalesce(is_active, true) = true
  )
  into target_branch_exists;

  if not target_branch_exists then
    raise exception 'Target branch not found or inactive';
  end if;

  if not exists (
    select 1
    from public.collections_lrs
    where gr_no = trim(p_gr_no)
      and upper(branch_code) = upper(trim(p_from_branch_code))
  ) then
    raise exception 'GR not found in your branch';
  end if;

  if exists (
    select 1
    from public.branch_transfer_requests
    where gr_no = trim(p_gr_no)
      and upper(from_branch_code) = upper(trim(p_from_branch_code))
      and status = 'PENDING'
  ) then
    raise exception 'A pending transfer request already exists for this GR';
  end if;

  insert into public.branch_transfer_requests (
    gr_no,
    from_branch_code,
    to_branch_code,
    requested_by
  )
  values (
    trim(p_gr_no),
    upper(trim(p_from_branch_code)),
    upper(trim(p_to_branch_code)),
    auth.uid()
  );
end;
$$;

create or replace function public.admin_list_branch_transfer_requests(p_status text default 'PENDING')
returns table (
  id uuid,
  gr_no text,
  from_branch_code text,
  to_branch_code text,
  from_branch_name text,
  to_branch_name text,
  party_name text,
  total_freight numeric,
  status text,
  requested_at timestamp with time zone,
  requested_by_email text,
  decided_at timestamp with time zone,
  reject_reason text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_admin() then
    raise exception 'Only admin can view branch transfer requests';
  end if;

  return query
  select
    r.id,
    r.gr_no::text,
    r.from_branch_code::text,
    r.to_branch_code::text,
    fb.branch_name::text as from_branch_name,
    tb.branch_name::text as to_branch_name,
    c.party_name::text,
    c.total_freight::numeric,
    r.status::text,
    r.requested_at,
    u.email::text as requested_by_email,
    r.decided_at,
    r.reject_reason::text
  from public.branch_transfer_requests r
  left join public.branches fb on upper(fb.branch_code) = upper(r.from_branch_code)
  left join public.branches tb on upper(tb.branch_code) = upper(r.to_branch_code)
  left join public.collections_lrs c
    on c.gr_no = r.gr_no
   and (upper(c.branch_code) = upper(r.from_branch_code) or (r.status = 'APPROVED' and upper(c.branch_code) = upper(r.to_branch_code)))
  left join auth.users u on u.id = r.requested_by
  where p_status is null or p_status = 'ALL' or r.status = upper(p_status)
  order by r.requested_at desc;
end;
$$;

create or replace function public.admin_approve_branch_transfer(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  req record;
  target_area_manager text;
begin
  if not public.is_current_admin() then
    raise exception 'Only admin can approve branch transfers';
  end if;

  select * into req
  from public.branch_transfer_requests
  where id = p_request_id
  for update;

  if req is null then
    raise exception 'Transfer request not found';
  end if;

  if req.status <> 'PENDING' then
    raise exception 'Transfer request is already processed';
  end if;

  if exists (
    select 1
    from public.collections_lrs
    where gr_no = req.gr_no
      and upper(branch_code) = upper(req.to_branch_code)
  ) then
    raise exception 'Target branch already has this GR number';
  end if;

  select area_manager into target_area_manager
  from public.branches
  where upper(branch_code) = upper(req.to_branch_code);

  update public.collections_lrs
  set
    branch_code = upper(req.to_branch_code),
    area_manager = coalesce(target_area_manager, area_manager),
    last_updated = now()
  where gr_no = req.gr_no
    and upper(branch_code) = upper(req.from_branch_code);

  if not found then
    raise exception 'Original GR row not found';
  end if;

  update public.branch_transfer_requests
  set
    status = 'APPROVED',
    decided_by = auth.uid(),
    decided_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.admin_reject_branch_transfer(
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_admin() then
    raise exception 'Only admin can reject branch transfers';
  end if;

  update public.branch_transfer_requests
  set
    status = 'REJECTED',
    decided_by = auth.uid(),
    decided_at = now(),
    reject_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_request_id
    and status = 'PENDING';

  if not found then
    raise exception 'Pending transfer request not found';
  end if;
end;
$$;

revoke execute on function public.request_branch_transfer(text, text, text) from public, anon;
revoke execute on function public.admin_list_branch_transfer_requests(text) from public, anon;
revoke execute on function public.admin_approve_branch_transfer(uuid) from public, anon;
revoke execute on function public.admin_reject_branch_transfer(uuid, text) from public, anon;

grant execute on function public.request_branch_transfer(text, text, text) to authenticated;
grant execute on function public.admin_list_branch_transfer_requests(text) to authenticated;
grant execute on function public.admin_approve_branch_transfer(uuid) to authenticated;
grant execute on function public.admin_reject_branch_transfer(uuid, text) to authenticated;
