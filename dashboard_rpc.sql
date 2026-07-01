-- 1. Dashboard Daily Collection Trend Graph
CREATE OR REPLACE FUNCTION get_dashboard_daily_trend(p_days INT, p_branch TEXT DEFAULT NULL)
RETURNS TABLE (
    report_date DATE,
    daily_collected NUMERIC,
    daily_freight NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        payment_date as report_date,
        SUM(LEAST(COALESCE(received_amount, 0), total_freight)) as daily_collected,
        SUM(total_freight) as daily_freight
    FROM collections_lrs
    WHERE 
        payment_date IS NOT NULL 
        AND payment_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        AND (p_branch IS NULL OR upper(branch_code) IN (SELECT branch_code FROM public.get_mapped_branches(p_branch)))
    GROUP BY payment_date
    ORDER BY payment_date ASC;
END;
$$ LANGUAGE plpgsql;

-- 2. Branch Inactivity Tracker
CREATE OR REPLACE FUNCTION get_branch_activity_monitor()
RETURNS TABLE (
    branch TEXT,
    total_grs BIGINT,
    collections_handled BIGINT,
    last_update DATE,
    days_inactive INT
) AS $$
BEGIN
    RETURN QUERY
    WITH branch_activity AS (
        SELECT 
            branch_code as branch,
            COUNT(gr_no) as total_grs,
            COUNT(CASE WHEN COALESCE(received_amount, 0) > 0 THEN 1 END) as collections_handled,
            MAX(
                GREATEST(
                    COALESCE(last_updated::DATE, DATE '1900-01-01'),
                    COALESCE(payment_date, DATE '1900-01-01'),
                    COALESCE(gr_date, DATE '1900-01-01')
                )
            ) as activity_date
        FROM collections_lrs
        GROUP BY branch_code
    )
    SELECT
        branch,
        total_grs,
        collections_handled,
        NULLIF(activity_date, DATE '1900-01-01') as last_update,
        CASE
            WHEN activity_date = DATE '1900-01-01' THEN NULL
            ELSE (CURRENT_DATE - activity_date)::INT
        END as days_inactive
    FROM branch_activity
    ORDER BY activity_date ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;
