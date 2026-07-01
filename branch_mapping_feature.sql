-- 1. Add mapped_to column to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS mapped_to text REFERENCES public.branches(branch_code);

-- 2. Create get_mapped_branches function
CREATE OR REPLACE FUNCTION public.get_mapped_branches(p_branch text)
RETURNS TABLE(branch_code text) AS $$
BEGIN
  RETURN QUERY
  SELECT upper(trim(p_branch))
  UNION
  SELECT upper(trim(b.branch_code)) FROM public.branches b WHERE upper(trim(b.mapped_to)) = upper(trim(p_branch));
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Create admin_map_branch function
CREATE OR REPLACE FUNCTION public.admin_map_branch(p_branch_code text, p_mapped_to text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admin can map branches';
  END IF;

  UPDATE public.branches
  SET mapped_to = NULLIF(upper(trim(p_mapped_to)), '')
  WHERE upper(branch_code) = upper(trim(p_branch_code));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_map_branch(text, text) TO authenticated;
