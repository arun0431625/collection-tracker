-- 1. Branch Summary Report
CREATE OR REPLACE FUNCTION get_reports_branch(
    p_from_date DATE,
    p_to_date DATE,
    p_branch_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    branch_code TEXT,
    total_grs BIGINT,
    collected_grs BIGINT,
    total_freight NUMERIC,
    collected NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.branch_code,
        COUNT(c.gr_no) as total_grs,
        COUNT(CASE WHEN LEAST(c.received_amount, c.total_freight) >= c.total_freight AND c.total_freight > 0 THEN 1 END) as collected_grs,
        COALESCE(SUM(c.total_freight), 0) as total_freight,
        COALESCE(SUM(LEAST(c.received_amount, c.total_freight)), 0) as collected
    FROM collections_lrs c
    WHERE c.gr_date >= p_from_date 
      AND c.gr_date <= p_to_date
      AND (p_branch_code IS NULL OR c.branch_code = p_branch_code)
    GROUP BY c.branch_code;
END;
$$ LANGUAGE plpgsql;

-- 2. Area Manager Summary Report
CREATE OR REPLACE FUNCTION get_reports_area(
    p_from_date DATE,
    p_to_date DATE,
    p_branch_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    area_manager TEXT,
    "totalGRs" BIGINT,
    "collectedGRs" BIGINT,
    "totalFreight" NUMERIC,
    collected NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(NULLIF(c.area_manager, ''), 'UNKNOWN') as area_manager,
        COUNT(c.gr_no) as "totalGRs",
        COUNT(CASE WHEN LEAST(c.received_amount, c.total_freight) >= c.total_freight AND c.total_freight > 0 THEN 1 END) as "collectedGRs",
        COALESCE(SUM(c.total_freight), 0) as "totalFreight",
        COALESCE(SUM(LEAST(c.received_amount, c.total_freight)), 0) as collected
    FROM collections_lrs c
    WHERE c.gr_date >= p_from_date 
      AND c.gr_date <= p_to_date
      AND (p_branch_code IS NULL OR c.branch_code = p_branch_code)
    GROUP BY COALESCE(NULLIF(c.area_manager, ''), 'UNKNOWN');
END;
$$ LANGUAGE plpgsql;

-- 3. Ageing Report
CREATE OR REPLACE FUNCTION get_reports_ageing(
    p_from_date DATE,
    p_to_date DATE,
    p_branch_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    bucket TEXT,
    balance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH diffs AS (
        SELECT 
            (c.total_freight - LEAST(COALESCE(c.received_amount, 0), c.total_freight)) as bal,
            CURRENT_DATE - c.gr_date as days
        FROM collections_lrs c
        WHERE c.gr_date >= p_from_date 
          AND c.gr_date <= p_to_date
          AND (p_branch_code IS NULL OR c.branch_code = p_branch_code)
    ),
    categorized AS (
        SELECT 
            CASE 
                WHEN days <= 30 THEN '0–30'
                WHEN days <= 60 THEN '31–60'
                WHEN days <= 90 THEN '61–90'
                ELSE '90+'
            END as bucket_name,
            bal
        FROM diffs
        WHERE bal > 0
    )
    SELECT 
        bucket_name as bucket,
        SUM(bal) as balance
    FROM categorized
    GROUP BY bucket_name;
END;
$$ LANGUAGE plpgsql;
