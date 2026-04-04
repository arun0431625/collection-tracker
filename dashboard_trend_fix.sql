-- Run this in your Supabase SQL Editor to update the Dashboard Chart logic
-- This will show Sales (GR Date) vs Collections (Payment Date)

DROP FUNCTION IF EXISTS public.get_dashboard_daily_trend(integer, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_daily_trend(p_days integer, p_branch text DEFAULT NULL::text)
 RETURNS TABLE(report_date date, daily_collected numeric, daily_sales numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN QUERY
    WITH sales AS (
        -- Sum of all freight by GR issuance date (Total Sales)
        SELECT 
            gr_date as d,
            SUM(total_freight) as amt
        FROM collections_lrs
        WHERE 
            gr_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
            AND (p_branch IS NULL OR branch_code = p_branch)
        GROUP BY gr_date
    ),
    collections AS (
        -- Sum of received amounts by actual payment date (Total Cash Inflow)
        SELECT 
            payment_date as d,
            SUM(LEAST(COALESCE(received_amount, 0), total_freight)) as amt
        FROM collections_lrs
        WHERE 
            payment_date IS NOT NULL 
            AND payment_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
            AND (p_branch IS NULL OR branch_code = p_branch)
        GROUP BY payment_date
    ),
    all_dates AS (
        -- Combine all relevant dates for a continuous timeline
        SELECT d FROM sales
        UNION
        SELECT d FROM collections
    )
    SELECT 
        ad.d as report_date,
        COALESCE(c.amt, 0) as daily_collected,
        COALESCE(s.amt, 0) as daily_sales
    FROM all_dates ad
    LEFT JOIN sales s ON s.d = ad.d
    LEFT JOIN collections c ON c.d = ad.d
    WHERE ad.d IS NOT NULL
    ORDER BY ad.d ASC;
END;
$function$;
