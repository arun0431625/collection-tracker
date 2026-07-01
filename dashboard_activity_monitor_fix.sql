-- Run this in Supabase SQL Editor to refresh the Branch Activity Monitor logic.
-- It makes "Last Update" and "Days Inactive" consider payment_date/gr_date too,
-- instead of relying only on last_updated.

CREATE OR REPLACE FUNCTION public.get_branch_activity_monitor()
RETURNS TABLE (
    branch text,
    total_grs bigint,
    collections_handled bigint,
    last_update date,
    days_inactive int
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH branch_activity AS (
        SELECT
            c.branch_code AS branch,
            COUNT(c.gr_no) AS total_grs,
            COUNT(CASE WHEN COALESCE(c.received_amount, 0) > 0 THEN 1 END) AS collections_handled,
            MAX(
                GREATEST(
                    COALESCE(c.last_updated::date, DATE '1900-01-01'),
                    COALESCE(c.payment_date, DATE '1900-01-01'),
                    COALESCE(c.gr_date, DATE '1900-01-01')
                )
            ) AS activity_date
        FROM public.collections_lrs c
        GROUP BY c.branch_code
    )
    SELECT
        b.branch,
        b.total_grs,
        b.collections_handled,
        NULLIF(b.activity_date, DATE '1900-01-01') AS last_update,
        CASE
            WHEN b.activity_date = DATE '1900-01-01' THEN NULL
            ELSE (CURRENT_DATE - b.activity_date)::int
        END AS days_inactive
    FROM branch_activity b
    ORDER BY b.activity_date ASC NULLS FIRST;
END;
$function$;
