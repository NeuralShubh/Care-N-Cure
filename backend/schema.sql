-- =========================================================================
-- Care N Cure Medical Shop Management System - Supabase Database Schema
-- Run this script in your Supabase Project's SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create Primary App State Table (Stores live application dataset & timestamps)
CREATE TABLE IF NOT EXISTS public.app_state (
    id TEXT PRIMARY KEY DEFAULT 'primary_state',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) and grant permissions
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated read/write access to app_state
CREATE POLICY "Allow public read access to app_state" 
    ON public.app_state FOR SELECT 
    USING (true);

CREATE POLICY "Allow public insert/update access to app_state" 
    ON public.app_state FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 3. Initialize default primary_state row if empty
INSERT INTO public.app_state (id, data, last_updated, updated_at)
VALUES (
    'primary_state',
    '{
        "employees": [{"id": "emp1", "name": "Owner / Admin", "mobile": "", "address": "", "designation": "Owner", "joiningDate": "2026-01-01", "salary": 0, "isOwner": true}],
        "medicines": [],
        "customers": [],
        "bills": [],
        "purchases": [],
        "reminders": [],
        "deletedReminders": [],
        "customCategories": [],
        "marketingTemplates": [],
        "config": {"billCounter": 1, "activeMarketingTemplateId": "", "initialized": true},
        "lastUpdated": 0
    }'::jsonb,
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 4. Optional Relational Schema (For advanced reporting or direct SQL queries)

-- Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    address TEXT,
    designation TEXT,
    joining_date DATE,
    salary NUMERIC(10, 2),
    is_owner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicines Table
CREATE TABLE IF NOT EXISTS public.medicines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    category TEXT,
    price NUMERIC(10, 2) DEFAULT 0.00,
    quantity INT DEFAULT 0,
    expiry_date DATE,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
    id TEXT PRIMARY KEY,
    bill_number TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    medicine_id TEXT REFERENCES public.medicines(id) ON DELETE SET NULL,
    medicine_name TEXT,
    purchase_date DATE,
    quantity INT DEFAULT 1,
    days_supply INT DEFAULT 7,
    finish_date DATE,
    bill_id TEXT REFERENCES public.bills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS public.reminders (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_mobile TEXT,
    medicine_id TEXT,
    medicine_name TEXT,
    finish_date DATE,
    custom_message TEXT,
    is_custom_message BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for optional relational tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write medicines" ON public.medicines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write reminders" ON public.reminders FOR ALL USING (true) WITH CHECK (true);
