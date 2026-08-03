-- TGM CAFE DATABASE SETUP FOR SUPABASE
-- Copy and paste this script into the Supabase SQL Editor.
-- This script creates the required tables, disables RLS for easy local POS access, and seeds the default menu.

-- =========================================================================
-- 1. Table Creation (Clean slate or safe creation)
-- =========================================================================
--ddjd
-- Optional: Uncomment the following lines if you want to completely reset the tables
-- DROP TABLE IF EXISTS public.purchases CASCADE;
-- DROP TABLE IF EXISTS public.bill_items CASCADE;
-- DROP TABLE IF EXISTS public.bills CASCADE;
-- DROP TABLE IF EXISTS public.menu CASCADE;

-- Menu Table
CREATE TABLE IF NOT EXISTS public.menu (
    id bigint primary key generated always as identity,
    name text not null,
    category text not null,
    price double precision not null,
    stock_count integer not null default 0
);

-- Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
    id bigint primary key generated always as identity,
    bill_number text not null unique,
    date_time timestamp with time zone not null,
    subtotal double precision not null,
    tax double precision not null default 0,
    total double precision not null,
    payment_method text not null
);

-- Bill Items Table
CREATE TABLE IF NOT EXISTS public.bill_items (
    id bigint primary key generated always as identity,
    bill_id bigint references public.bills(id) on delete cascade not null,
    item_id bigint references public.menu(id) on delete set null,
    item_name text not null,
    quantity integer not null,
    price double precision not null,
    total double precision not null
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS public.purchases (
    id bigint primary key generated always as identity,
    date text not null, -- stored as 'YYYY-MM-DD'
    description text not null,
    quantity double precision not null,
    price double precision not null,
    total double precision not null,
    category text not null
);

-- =========================================================================
-- 2. Security Setup (RLS enabled with public POS policies)
-- =========================================================================
-- Keep RLS enabled and allow anon/authenticated access for this POS app.
-- Note: This makes the data publicly writable with your publishable key.
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_public_all ON public.menu;
CREATE POLICY menu_public_all
ON public.menu
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS bills_public_all ON public.bills;
CREATE POLICY bills_public_all
ON public.bills
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS bill_items_public_all ON public.bill_items;
CREATE POLICY bill_items_public_all
ON public.bill_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS purchases_public_all ON public.purchases;
CREATE POLICY purchases_public_all
ON public.purchases
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- =========================================================================
-- 3. Clear existing menu items (Optional: uncomment to start fresh)
-- =========================================================================
-- DELETE FROM public.menu;

-- =========================================================================
-- 4. Seed Menu Items
-- =========================================================================
INSERT INTO public.menu (name, category, price, stock_count) VALUES
-- Hot Drinks
('Tea', 'Hot Drinks', 15, 1000),
('Coffee', 'Hot Drinks', 20, 1000),
('Ginger Tea', 'Hot Drinks', 20, 1000),
('Masala Tea', 'Hot Drinks', 25, 1000),
('Lemon Tea', 'Hot Drinks', 20, 1000),
('Green Tea', 'Hot Drinks', 30, 1000),
('Boost', 'Hot Drinks', 35, 1000),
('Horlicks', 'Hot Drinks', 35, 1000),

-- Chat Items
('Pani Puri', 'Chat Items', 30, 99),
('Masal Puri', 'Chat Items', 30, 99),
('Bhel Puri', 'Chat Items', 40, 99),
('Dahi Puri', 'Chat Items', 50, 99),
('Samosa Chat', 'Chat Items', 50, 99),
('Kalan', 'Chat Items', 50, 99),
('Cauliflower Chilli', 'Chat Items', 50, 98),
('Chicken Chill', 'Chat Items', 60, 98),

-- Milk Shake
('Chocolate Shake', 'Milk Shake', 90, 50),
('Vanilla Shake', 'Milk Shake', 80, 50),
('Strawberry Shake', 'Milk Shake', 80, 50),
('Pista Shake', 'Milk Shake', 90, 50),
('Badam Shake', 'Milk Shake', 100, 50),
('Oreo Shake', 'Milk Shake', 110, 50),

-- Cooling / Cold Drinks
('Badam Milk', 'Cooling', 30, 99),
('Boost (Cold)', 'Cooling', 50, 100),
('Cold Coffee', 'Cooling', 70, 94),
('Rose Milk', 'Cooling', 40, 100),
('Lassi', 'Cooling', 50, 50),

-- Starters
('French Fries', 'Starter (Veg)', 80, 50),
('Cheese Fries', 'Starter (Veg)', 100, 50),
('Veg Nuggets', 'Starter (Veg)', 90, 50),
('Chicken Nuggets', 'Starter (Non-Veg)', 120, 50),
('Chicken Popcorn', 'Starter (Non-Veg)', 130, 50),

-- Rice & Noodles
('Veg Fried Rice', 'Rice & Noodle', 100, 50),
('Egg Fried Rice', 'Rice & Noodle', 120, 50),
('Chicken Fried Rice', 'Rice & Noodle', 140, 50),
('Veg Noodles', 'Rice & Noodle', 100, 50),
('Egg Noodles', 'Rice & Noodle', 120, 50),
('Chicken Noodles', 'Rice & Noodle', 140, 50),

-- Savories (By weight)
('Murukku', 'Savories', 30, 1000),
('Kara Boondi', 'Savories', 25, 1000),
('Mixture', 'Savories', 35, 1000),
('Pakoda', 'Savories', 40, 1000),
