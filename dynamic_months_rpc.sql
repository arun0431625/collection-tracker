-- Run this in your Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.get_collection_months()
RETURNS TABLE (
    value TEXT,
    label TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        TO_CHAR(gr_date, 'YYYY-MM') as value,
        TO_CHAR(gr_date, 'Mon YYYY') as label
    FROM public.collections_lrs
    WHERE gr_date IS NOT NULL
    ORDER BY value ASC; -- Oldest to Latest as requested
END;
$$;
