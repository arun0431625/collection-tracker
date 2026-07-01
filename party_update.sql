-- Update for get_party_outstanding to include branches
CREATE OR REPLACE FUNCTION get_party_outstanding(
    p_branch_code TEXT DEFAULT NULL,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    party_name TEXT,
    branches TEXT,
    total_grs BIGINT,
    collected_grs BIGINT,
    total_freight NUMERIC,
    collected NUMERIC,
    balance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH diffs AS (
        SELECT 
            COALESCE(c.party_name, 'UNKNOWN') as party_name,
            c.branch_code,
            1 as gr_count,
            CASE WHEN LEAST(COALESCE(c.received_amount, 0), c.total_freight) >= c.total_freight AND c.total_freight > 0 THEN 1 ELSE 0 END as collected_gr,
            COALESCE(c.total_freight, 0) as freight,
            LEAST(COALESCE(c.received_amount, 0), COALESCE(c.total_freight, 0)) as coll
        FROM collections_lrs c
        WHERE (p_branch_code IS NULL OR upper(c.branch_code) IN (SELECT branch_code FROM public.get_mapped_branches(p_branch_code)))
          AND (p_from_date IS NULL OR c.gr_date >= p_from_date)
          AND (p_to_date IS NULL OR c.gr_date <= p_to_date)
          AND (p_search IS NULL OR c.party_name ILIKE '%' || p_search || '%')
    )
    SELECT 
        d.party_name,
        STRING_AGG(DISTINCT d.branch_code, ' | ') as branches,
        SUM(d.gr_count)::BIGINT as total_grs,
        SUM(d.collected_gr)::BIGINT as collected_grs,
        SUM(d.freight) as total_freight,
        SUM(d.coll) as collected,
        SUM(d.freight - d.coll) as balance
    FROM diffs d
    GROUP BY d.party_name
    ORDER BY d.party_name ASC;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_collections_lrs_party_reports
ON collections_lrs (gr_date, branch_code, party_name);

CREATE OR REPLACE FUNCTION get_party_outstanding_page(
    p_branch_code TEXT DEFAULT NULL,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_sort_key TEXT DEFAULT 'total_freight',
    p_sort_dir TEXT DEFAULT 'desc',
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    party_name TEXT,
    branches TEXT,
    total_grs BIGINT,
    collected_grs BIGINT,
    total_freight NUMERIC,
    collected NUMERIC,
    balance NUMERIC,
    total_count BIGINT
) AS $$
DECLARE
    v_sort_key TEXT := COALESCE(p_sort_key, 'total_freight');
    v_sort_dir TEXT := CASE WHEN LOWER(COALESCE(p_sort_dir, 'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
    v_order_expr TEXT;
BEGIN
    v_order_expr := CASE v_sort_key
        WHEN 'party_name' THEN 'party_name'
        WHEN 'branches' THEN 'branches'
        WHEN 'total_grs' THEN 'total_grs'
        WHEN 'collected_grs' THEN 'collected_grs'
        WHEN 'total_freight' THEN 'total_freight'
        WHEN 'collected' THEN 'collected'
        WHEN 'balance' THEN 'balance'
        WHEN 'lr_pct' THEN 'CASE WHEN total_grs = 0 THEN 0 ELSE collected_grs::numeric / total_grs END'
        WHEN 'amt_pct' THEN 'CASE WHEN total_freight = 0 THEN 0 ELSE collected / total_freight END'
        ELSE 'total_freight'
    END;

    RETURN QUERY EXECUTE format(
        $sql$
        WITH diffs AS (
            SELECT
                COALESCE(c.party_name, 'UNKNOWN') AS party_name,
                c.branch_code,
                1 AS gr_count,
                CASE
                    WHEN LEAST(COALESCE(c.received_amount, 0), c.total_freight) >= c.total_freight
                         AND c.total_freight > 0 THEN 1
                    ELSE 0
                END AS collected_gr,
                COALESCE(c.total_freight, 0) AS freight,
                LEAST(COALESCE(c.received_amount, 0), COALESCE(c.total_freight, 0)) AS coll
            FROM collections_lrs c
            WHERE ($1 IS NULL OR upper(c.branch_code) IN (SELECT branch_code FROM public.get_mapped_branches($1)))
              AND ($2 IS NULL OR c.gr_date >= $2)
              AND ($3 IS NULL OR c.gr_date <= $3)
              AND ($4 IS NULL OR c.party_name ILIKE '%%' || $4 || '%%')
        ),
        grouped AS (
            SELECT
                d.party_name,
                STRING_AGG(DISTINCT d.branch_code, ' | ') AS branches,
                SUM(d.gr_count)::BIGINT AS total_grs,
                SUM(d.collected_gr)::BIGINT AS collected_grs,
                SUM(d.freight) AS total_freight,
                SUM(d.coll) AS collected,
                SUM(d.freight - d.coll) AS balance
            FROM diffs d
            GROUP BY d.party_name
        ),
        counted AS (
            SELECT
                g.*,
                COUNT(*) OVER()::BIGINT AS total_count
            FROM grouped g
        )
        SELECT
            c.party_name,
            c.branches,
            c.total_grs,
            c.collected_grs,
            c.total_freight,
            c.collected,
            c.balance,
            c.total_count
        FROM counted c
        ORDER BY %s %s, c.party_name ASC
        LIMIT %s OFFSET %s
        $sql$,
        v_order_expr,
        v_sort_dir,
        GREATEST(COALESCE(p_limit, 25), 1),
        GREATEST(COALESCE(p_offset, 0), 0)
    )
    USING p_branch_code, p_from_date, p_to_date, p_search;
END;
$$ LANGUAGE plpgsql;
