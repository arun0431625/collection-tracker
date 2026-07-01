-- Run this in Supabase SQL Editor for the Dashboard timeline upgrade.
-- It adds day/week/month aggregation support plus branch filtering.

CREATE INDEX IF NOT EXISTS idx_collections_lrs_dashboard_gr_date_branch
ON public.collections_lrs (gr_date, branch_code);

CREATE INDEX IF NOT EXISTS idx_collections_lrs_dashboard_payment_date_branch
ON public.collections_lrs (payment_date, branch_code)
WHERE payment_date IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_dashboard_collection_timeline(text, integer, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_collection_timeline(
    p_mode text DEFAULT 'day',
    p_points integer DEFAULT 15,
    p_branch text DEFAULT NULL
)
RETURNS TABLE (
    period_start date,
    total_collected numeric,
    total_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_mode text := lower(coalesce(p_mode, 'day'));
    v_points integer := greatest(coalesce(p_points, 15), 1);
    v_current_start date;
    v_from_date date;
BEGIN
    IF v_mode NOT IN ('day', 'week', 'month') THEN
        v_mode := 'day';
    END IF;

    v_current_start := CASE
        WHEN v_mode = 'week' THEN date_trunc('week', CURRENT_DATE)::date
        WHEN v_mode = 'month' THEN date_trunc('month', CURRENT_DATE)::date
        ELSE CURRENT_DATE
    END;

    v_from_date := CASE
        WHEN v_mode = 'week' THEN (v_current_start - ((v_points - 1) * interval '7 days'))::date
        WHEN v_mode = 'month' THEN (v_current_start - ((v_points - 1) * interval '1 month'))::date
        ELSE (CURRENT_DATE - ((v_points - 1) * interval '1 day'))::date
    END;

    RETURN QUERY
    WITH sales AS (
        SELECT
            CASE
                WHEN v_mode = 'week' THEN date_trunc('week', c.gr_date)::date
                WHEN v_mode = 'month' THEN date_trunc('month', c.gr_date)::date
                ELSE c.gr_date
            END AS bucket_start,
            sum(coalesce(c.total_freight, 0)) AS amount
        FROM public.collections_lrs c
        WHERE c.gr_date IS NOT NULL
          AND c.gr_date >= v_from_date
          AND (p_branch IS NULL OR upper(c.branch_code) IN (SELECT branch_code FROM public.get_mapped_branches(p_branch)))
        GROUP BY 1
    ),
    collections AS (
        SELECT
            CASE
                WHEN v_mode = 'week' THEN date_trunc('week', c.payment_date)::date
                WHEN v_mode = 'month' THEN date_trunc('month', c.payment_date)::date
                ELSE c.payment_date
            END AS bucket_start,
            sum(least(coalesce(c.received_amount, 0), coalesce(c.total_freight, 0))) AS amount
        FROM public.collections_lrs c
        WHERE c.payment_date IS NOT NULL
          AND c.payment_date >= v_from_date
          AND (p_branch IS NULL OR upper(c.branch_code) IN (SELECT branch_code FROM public.get_mapped_branches(p_branch)))
        GROUP BY 1
    ),
    buckets AS (
        SELECT bucket_start FROM sales
        UNION
        SELECT bucket_start FROM collections
    )
    SELECT
        b.bucket_start AS period_start,
        coalesce(col.amount, 0) AS total_collected,
        coalesce(s.amount, 0) AS total_sales
    FROM buckets b
    LEFT JOIN sales s ON s.bucket_start = b.bucket_start
    LEFT JOIN collections col ON col.bucket_start = b.bucket_start
    WHERE b.bucket_start IS NOT NULL
    ORDER BY b.bucket_start ASC;
END;
$function$;
