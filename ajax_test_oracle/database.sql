-- PostgreSQL. Jadval backend tomonidan ham avtomatik yaratiladi.
CREATE TABLE IF NOT EXISTS ajax_test_results (
    id UUID PRIMARY KEY,
    user_name VARCHAR(30) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    total INTEGER NOT NULL CHECK (total > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajax_results_created
    ON ajax_test_results (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ajax_results_score
    ON ajax_test_results (score DESC, created_at ASC);
