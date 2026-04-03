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
        NULLIF(payment_date, '')::DATE as report_date,
        SUM(LEAST(COALESCE(received_amount, 0), total_freight)) as daily_collected,
        SUM(total_freight) as daily_freight
    FROM collections_lrs
    WHERE 
        NULLIF(payment_date, '') IS NOT NULL 
        AND NULLIF(payment_date, '')::DATE >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        AND (p_branch IS NULL OR branch_code = p_branch)
    GROUP BY NULLIF(payment_date, '')::DATE
    ORDER BY NULLIF(payment_date, '')::DATE ASC;
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
    SELECT 
        branch_code as branch,
        COUNT(gr_no) as total_grs,
        COUNT(CASE WHEN received_amount > 0 THEN 1 END) as collections_handled,
        MAX(last_updated)::DATE as last_update,
        (CURRENT_DATE - MAX(last_updated)::DATE)::INT as days_inactive
    FROM collections_lrs
    GROUP BY branch_code
    ORDER BY MAX(last_updated)::DATE ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;
