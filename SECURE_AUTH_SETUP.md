# Secure Auth Setup

Run [`scripts/secure_auth_setup.sql`](/C:/Users/Arun%20Saini/collection-ui/scripts/secure_auth_setup.sql) in Supabase SQL Editor.

## After SQL runs
1. In SQL Editor, run:
   `select public.admin_provision_branch_auth_users();`
2. Reset one non-admin branch from the app Security page.
3. Login with:
   - username: branch code, for example `AGRA`
   - password: `Branch@123`

## Expected behavior
- Branch login uses Supabase Auth now.
- Password hashes are no longer fetched by the frontend.
- First login after reset forces a password change.
- Admin reset/delete/toggle, upload writes, security summaries, and branch filters depend on the SQL functions above.

## If login fails
- Confirm an auth user exists:
  `select email from auth.users where lower(email) = 'agra@tracker.com';`
- Re-run:
  `select public.admin_provision_branch_auth_users();`
