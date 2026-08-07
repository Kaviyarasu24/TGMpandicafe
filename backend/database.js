import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL environment variable is not set. The backend cannot connect to PostgreSQL. Exiting.');
  process.exit(1);
}

// Automatically parse DECIMAL/NUMERIC fields (OID 1700) as floats
pg.types.setTypeParser(1700, (val) => parseFloat(val));

// Round a monetary value to 2 decimal places (paise precision) on write, so
// float arithmetic (e.g. weight-based price * kg) can't persist long decimal tails.
// The +EPSILON nudge avoids classic 1.005 -> 1.00 rounding errors.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const cleanConnectionString = connectionString.split('?')[0];

const pool = new pg.Pool({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});

const initDb = async () => {
  try {
    console.log(`Initializing PostgreSQL Database...`);
    await createTables();
  } catch (err) {
    console.error('Error initializing PostgreSQL database:', err.message);
  }
};

const createTables = async () => {
  // Menu Table
  await pool.query(`CREATE TABLE IF NOT EXISTS menu (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_count INT NOT NULL,
    min_stock INT NOT NULL DEFAULT 10,
    image_url TEXT
  )`);

  // Bills Table
  await pool.query(`CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    bill_number VARCHAR(255) NOT NULL UNIQUE,
    date_time VARCHAR(255) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL
  )`);

  // Bill Items Table
  await pool.query(`CREATE TABLE IF NOT EXISTS bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INT NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  )`);

  // Purchases Table
  await pool.query(`CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    date VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    category VARCHAR(255) NOT NULL
  )`);

  // Inventory Logs Table
  await pool.query(`CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    date VARCHAR(50) NOT NULL,
    time VARCHAR(50) NOT NULL,
    bill_number VARCHAR(255) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    previous_stock DECIMAL(10,2) NOT NULL,
    restored_quantity DECIMAL(10,2) NOT NULL,
    updated_stock DECIMAL(10,2) NOT NULL,
    action VARCHAR(255) NOT NULL
  )`);

  // Categories Table
  await pool.query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    pricing_type VARCHAR(50) NOT NULL,
    weight_unit VARCHAR(50)
  )`);

  // Users Table
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    mobile VARCHAR(50),
    theme VARCHAR(50) DEFAULT 'light'
  )`);

  // Audit Logs Table — records who did what, for accountability
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username VARCHAR(255),
    role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details TEXT
  )`);

  // Held / Parked Orders Table — cashier can save a cart and resume later
  await pool.query(`CREATE TABLE IF NOT EXISTS held_orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    label VARCHAR(255) NOT NULL,
    created_by VARCHAR(255),
    cart_data JSONB NOT NULL
  )`);

  // Idempotent migration: add a status column to bills for void support.
  // Existing rows default to 'completed' so current behavior is unchanged.
  await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'completed'`);
  await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS void_reason TEXT`);

  // Seed default categories using ON CONFLICT DO NOTHING
  const defaultCats = [
    { name: 'Hot Drinks', pricing: 'fixed', unit: null },
    { name: 'Milk Shake', pricing: 'fixed', unit: null },
    { name: 'Mojito', pricing: 'fixed', unit: null },
    { name: 'Chat Items', pricing: 'fixed', unit: null },
    { name: 'Scopes', pricing: 'fixed', unit: null },
    { name: 'Juice', pricing: 'fixed', unit: null },
    { name: 'Cooling', pricing: 'fixed', unit: null },
    { name: 'Starter (Veg)', pricing: 'fixed', unit: null },
    { name: 'Rice & Noodle', pricing: 'fixed', unit: null },
    { name: 'Starter (Non-Veg)', pricing: 'fixed', unit: null },
    { name: 'Desserts', pricing: 'fixed', unit: null },
    { name: 'Savories', pricing: 'weight', unit: '100g' },
    { name: 'Sweets', pricing: 'weight', unit: '1kg' }
  ];
  for (const c of defaultCats) {
    await pool.query(
      `INSERT INTO categories (name, pricing_type, weight_unit) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [c.name, c.pricing, c.unit]
    );
  }

  // Seed default admin and sales users
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
  if (parseInt(rows[0].count, 10) === 0) {
    const defaultPassword = 'password';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    
    await pool.query(`INSERT INTO users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`, ['admin', hash, 'admin', 'System Administrator']);
    await pool.query(`INSERT INTO users (username, password_hash, role, full_name) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`, ['sales', hash, 'sales', 'Sales Staff']);
    console.log('Default users seeded.');
  }
};

// Initialize DB immediately on start
initDb();

// Helper to convert SQLite/MySQL '?' placeholders to PostgreSQL '$1, $2' positional parameters
const convertPlaceholders = (query) => {
  let count = 1;
  return query.replace(/\?/g, () => `$${count++}`);
};

export const runQuery = async (query, params = []) => {
  const convertedSql = convertPlaceholders(query);
  const result = await pool.query(convertedSql, params);
  const insertedId = result.rows && result.rows[0] ? result.rows[0].id : null;
  return { id: insertedId, changes: result.rowCount };
};

export const getQuery = async (query, params = []) => {
  const convertedSql = convertPlaceholders(query);
  const result = await pool.query(convertedSql, params);
  return result.rows;
};

export const getSingleQuery = async (query, params = []) => {
  const convertedSql = convertPlaceholders(query);
  const result = await pool.query(convertedSql, params);
  return result.rows[0] || null;
};

// --- MENU OPERATIONS ---

export const getMenu = async () => {
  return await getQuery(`SELECT id, name, category, price, stock_count, min_stock, image_url FROM menu ORDER BY category, name`);
};

export const addMenuItem = async (item) => {
  return await runQuery(
    `INSERT INTO menu (name, category, price, stock_count, min_stock, image_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [item.name, item.category, item.price, item.stock_count, item.min_stock ?? 10, item.image_url || null]
  );
};

export const updateMenuItem = async (item) => {
  return await runQuery(
    `UPDATE menu SET name = ?, category = ?, price = ?, stock_count = ?, min_stock = ?, image_url = ? WHERE id = ?`,
    [item.name, item.category, item.price, item.stock_count, item.min_stock ?? 10, item.image_url || null, item.id]
  );
};

export const deleteMenuItem = async (id) => {
  return await runQuery(`DELETE FROM menu WHERE id = ?`, [id]);
};

// --- BILLING OPERATIONS ---

export const createBill = async (billData) => {
  // Retry the whole transaction on a bill_number unique-violation (23505),
  // which can happen if two bills are created concurrently and compute the
  // same daily sequence. A short retry recomputes the next free number.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dateStr = billData.date.replace(/-/g, '');
      const datePrefix = `${dateStr}-%`;

      // Calculate max daily sequence number from bills
      const maxBillRes = await client.query(
        `SELECT MAX(CAST(SUBSTR(bill_number, 13) AS INTEGER)) as max_num FROM bills WHERE bill_number LIKE $1`,
        [`BL-${datePrefix}`]
      );

      // Calculate max daily sequence number from deleted bills in inventory_logs
      const maxLogRes = await client.query(
        `SELECT MAX(CAST(SUBSTR(bill_number, 13) AS INTEGER)) as max_num FROM inventory_logs WHERE bill_number LIKE $1 AND action = 'Bill Deleted'`,
        [`BL-${datePrefix}`]
      );

      const maxFromBills = maxBillRes.rows[0]?.max_num || 0;
      const maxFromLogs = maxLogRes.rows[0]?.max_num || 0;
      const nextSequence = Math.max(maxFromBills, maxFromLogs, 0) + attempt;

      const finalBillNumber = `BL-${dateStr}-${nextSequence.toString().padStart(4, '0')}`;

      const billInsert = await client.query(
        `INSERT INTO bills (bill_number, date_time, subtotal, tax, total, payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [finalBillNumber, `${billData.date}T${billData.time}`, round2(billData.subtotal), round2(billData.tax), round2(billData.total), billData.payment_method]
      );
      const billId = billInsert.rows[0].id;

      for (const item of billData.items) {
        await client.query(
          `INSERT INTO bill_items (bill_id, item_id, item_name, quantity, price, total) VALUES ($1, $2, $3, $4, $5, $6)`,
          [billId, item.id, item.name, item.quantity, item.price, round2(item.quantity * item.price)]
        );

        await client.query(
          `UPDATE menu SET stock_count = stock_count - $1 WHERE id = $2`,
          [item.quantity, item.id]
        );
      }

      await client.query('COMMIT');
      return { success: true, billNumber: finalBillNumber };
    } catch (err) {
      await client.query('ROLLBACK');
      // 23505 = unique_violation. Retry with a bumped sequence if attempts remain.
      if (err.code === '23505' && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error('Failed to generate a unique bill number after multiple attempts.');
};

export const getBills = async ({ limit = null, offset = 0 } = {}) => {
  let query = `SELECT id, bill_number, date_time, subtotal, tax, total, payment_method, status, void_reason FROM bills ORDER BY date_time DESC`;
  const params = [];
  if (limit != null) {
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
  }
  const bills = await getQuery(query, params);

  if (bills.length === 0) return bills;

  // Batch-load all items for these bills in a single query (avoids N+1 queries).
  const billIds = bills.map((b) => b.id);
  const placeholders = billIds.map(() => '?').join(', ');
  const allItems = await getQuery(
    `SELECT id, bill_id, item_id, item_name, quantity, price, total FROM bill_items WHERE bill_id IN (${placeholders})`,
    billIds
  );

  // Group items by bill_id, then attach to each bill (empty array if none).
  const itemsByBill = new Map();
  for (const item of allItems) {
    if (!itemsByBill.has(item.bill_id)) itemsByBill.set(item.bill_id, []);
    itemsByBill.get(item.bill_id).push(item);
  }
  for (const bill of bills) {
    bill.items = itemsByBill.get(bill.id) || [];
  }

  return bills;
};

export const getBillsCount = async () => {
  const row = await getSingleQuery(`SELECT COUNT(*) as count FROM bills`);
  return parseInt(row?.count || 0, 10);
};

export const getDashboardStats = async () => {
  const today = new Date().toISOString().split('T')[0];
  const todayPrefix = `${today}%`;

  const totalBillsRow = await getSingleQuery(`SELECT COUNT(*) as count FROM bills WHERE date_time LIKE ? AND status != 'voided'`, [todayPrefix]);
  const totalSalesRow = await getSingleQuery(`SELECT SUM(total) as sum FROM bills WHERE date_time LIKE ? AND status != 'voided'`, [todayPrefix]);

  const totalItemsSoldRow = await getSingleQuery(`
    SELECT SUM(quantity) as sum
    FROM bill_items
    JOIN bills ON bill_items.bill_id = bills.id
    WHERE bills.date_time LIKE ? AND bills.status != 'voided'
  `, [todayPrefix]);

  const mostSoldRow = await getSingleQuery(`
    SELECT item_name, SUM(quantity) as sum
    FROM bill_items
    JOIN bills ON bill_items.bill_id = bills.id
    WHERE bills.date_time LIKE ? AND bills.status != 'voided'
    GROUP BY item_id, item_name
    ORDER BY sum DESC LIMIT 1
  `, [todayPrefix]);

  const lowStockItemsList = await getQuery(`SELECT id, name, category, price, stock_count, min_stock, image_url FROM menu WHERE stock_count <= min_stock ORDER BY stock_count ASC`);

  const totalPurchasesRow = await getSingleQuery(`SELECT SUM(total) as sum FROM purchases WHERE date = ?`, [today]);

  return {
    totalBillsToday: parseInt(totalBillsRow?.count || 0, 10),
    totalSalesToday: parseFloat(totalSalesRow?.sum || 0),
    totalItemsSold: parseFloat(totalItemsSoldRow?.sum || 0),
    mostSoldItem: mostSoldRow ? mostSoldRow.item_name : 'N/A',
    lowStockCount: lowStockItemsList.length,
    lowStockItems: lowStockItemsList,
    totalPurchasesToday: parseFloat(totalPurchasesRow?.sum || 0)
  };
};

export const deleteBill = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billRes = await client.query(`SELECT * FROM bills WHERE id = $1`, [id]);
    const bill = billRes.rows[0];
    if (!bill) {
      throw new Error("Bill not found or already deleted");
    }

    const itemsRes = await client.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [id]);
    const items = itemsRes.rows;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    for (const item of items) {
      const menuRes = await client.query(`SELECT stock_count FROM menu WHERE id = $1`, [item.item_id]);
      const menuRow = menuRes.rows[0];
      if (menuRow) {
        const previousStock = menuRow.stock_count;
        const newStock = previousStock + item.quantity;
        
        await client.query(`UPDATE menu SET stock_count = $1 WHERE id = $2`, [newStock, item.item_id]);

        await client.query(
          `INSERT INTO inventory_logs (date, time, bill_number, item_name, previous_stock, restored_quantity, updated_stock, action) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [dateStr, timeStr, bill.bill_number, item.item_name, previousStock, item.quantity, newStock, 'Bill Deleted']
        );
      }
    }

    await client.query(`DELETE FROM bill_items WHERE bill_id = $1`, [id]);
    await client.query(`DELETE FROM bills WHERE id = $1`, [id]);

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateBill = async (billData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oldItemsRes = await client.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [billData.id]);
    const oldItems = oldItemsRes.rows;
    for (const item of oldItems) {
      await client.query(`UPDATE menu SET stock_count = stock_count + $1 WHERE id = $2`, [item.quantity, item.item_id]);
    }

    await client.query(`DELETE FROM bill_items WHERE bill_id = $1`, [billData.id]);

    await client.query(
      `UPDATE bills SET subtotal = $1, tax = $2, total = $3, payment_method = $4 WHERE id = $5`,
      [round2(billData.subtotal), round2(billData.tax), round2(billData.total), billData.payment_method, billData.id]
    );

    for (const item of billData.items) {
      await client.query(
        `INSERT INTO bill_items (bill_id, item_id, item_name, quantity, price, total) VALUES ($1, $2, $3, $4, $5, $6)`,
        [billData.id, item.id, item.name, item.quantity, item.price, round2(item.quantity * item.price)]
      );

      await client.query(
        `UPDATE menu SET stock_count = stock_count - $1 WHERE id = $2`,
        [item.quantity, item.id]
      );
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// --- PURCHASES OPERATIONS ---

export const getPurchases = async () => {
  return await getQuery(`SELECT id, date, description, quantity, price, total, category FROM purchases ORDER BY date DESC, id DESC`);
};

export const addPurchaseItem = async (item) => {
  return await runQuery(
    `INSERT INTO purchases (date, description, quantity, price, total, category) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [item.date, item.description, item.quantity, item.price, round2(item.quantity * item.price), item.category]
  );
};

export const updatePurchaseItem = async (item) => {
  return await runQuery(
    `UPDATE purchases SET date = ?, description = ?, quantity = ?, price = ?, total = ?, category = ? WHERE id = ?`,
    [item.date, item.description, item.quantity, item.price, round2(item.quantity * item.price), item.category, item.id]
  );
};

export const deletePurchaseItem = async (id) => {
  return await runQuery(`DELETE FROM purchases WHERE id = ?`, [id]);
};

// --- CATEGORIES OPERATIONS ---

export const getCategories = async () => {
  return await getQuery(`SELECT id, name, pricing_type, weight_unit FROM categories ORDER BY name ASC`);
};

export const addCategory = async (cat) => {
  return await runQuery(
    `INSERT INTO categories (name, pricing_type, weight_unit) VALUES (?, ?, ?) RETURNING id`,
    [cat.name, cat.pricing_type, cat.weight_unit || null]
  );
};

export const deleteCategory = async (id) => {
  return await runQuery(`DELETE FROM categories WHERE id = ?`, [id]);
};

// --- USER OPERATIONS ---

export const getUserByUsername = async (username) => {
  return await getSingleQuery(`SELECT id, username, password_hash, role, full_name, email, mobile, theme FROM users WHERE username = ?`, [username]);
};

export const updateUserPassword = async (username, newHash) => {
  return await runQuery(`UPDATE users SET password_hash = ? WHERE username = ?`, [newHash, username]);
};

export const updateUserProfile = async (username, data) => {
  return await runQuery(
    `UPDATE users SET full_name = ?, email = ?, mobile = ?, theme = ? WHERE username = ?`,
    [data.full_name, data.email, data.mobile, data.theme, username]
  );
};

export const getUsers = async () => {
  return await getQuery(`SELECT id, username, role, full_name, email, mobile, theme FROM users ORDER BY username ASC`);
};

export const addUser = async (user) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(user.password || 'password', salt);
  return await runQuery(
    `INSERT INTO users (username, password_hash, role, full_name, email, mobile, theme) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [user.username, hash, user.role, user.full_name || null, user.email || null, user.mobile || null, 'light']
  );
};

export const updateUser = async (id, user) => {
  return await runQuery(
    `UPDATE users SET username = ?, role = ?, full_name = ?, email = ?, mobile = ? WHERE id = ?`,
    [user.username, user.role, user.full_name || null, user.email || null, user.mobile || null, id]
  );
};

export const deleteUser = async (id) => {
  return await runQuery(`DELETE FROM users WHERE id = ?`, [id]);
};

// --- AUDIT LOG OPERATIONS ---

export const addAuditLog = async ({ username, role, action, entity, entity_id, details }) => {
  try {
    return await runQuery(
      `INSERT INTO audit_logs (username, role, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [username || null, role || null, action, entity, entity_id != null ? String(entity_id) : null, details || null]
    );
  } catch (err) {
    // Auditing must never break the primary operation; log and continue.
    console.error('Failed to write audit log:', err.message);
    return { id: null };
  }
};

export const getAuditLogs = async ({ limit = 100, offset = 0 } = {}) => {
  return await getQuery(
    `SELECT id, created_at, username, role, action, entity, entity_id, details FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
};

// --- HELD / PARKED ORDER OPERATIONS ---

export const getHeldOrders = async () => {
  return await getQuery(`SELECT id, created_at, label, created_by, cart_data FROM held_orders ORDER BY created_at DESC`);
};

export const addHeldOrder = async ({ label, created_by, cart_data }) => {
  return await runQuery(
    `INSERT INTO held_orders (label, created_by, cart_data) VALUES (?, ?, ?) RETURNING id`,
    [label, created_by || null, JSON.stringify(cart_data)]
  );
};

export const deleteHeldOrder = async (id) => {
  return await runQuery(`DELETE FROM held_orders WHERE id = ?`, [id]);
};

// --- VOID BILL OPERATION ---
// Marks a bill as voided (soft, recoverable trail) and restores stock, instead
// of hard-deleting. Uses the same inventory_logs trail as deleteBill.
export const voidBill = async (id, reason) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billRes = await client.query(`SELECT * FROM bills WHERE id = $1`, [id]);
    const bill = billRes.rows[0];
    if (!bill) {
      throw new Error('Bill not found');
    }
    if (bill.status === 'voided') {
      throw new Error('Bill is already voided');
    }

    const itemsRes = await client.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [id]);
    const items = itemsRes.rows;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    for (const item of items) {
      const menuRes = await client.query(`SELECT stock_count FROM menu WHERE id = $1`, [item.item_id]);
      const menuRow = menuRes.rows[0];
      if (menuRow) {
        const previousStock = menuRow.stock_count;
        const newStock = previousStock + item.quantity;
        await client.query(`UPDATE menu SET stock_count = $1 WHERE id = $2`, [newStock, item.item_id]);
        await client.query(
          `INSERT INTO inventory_logs (date, time, bill_number, item_name, previous_stock, restored_quantity, updated_stock, action) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [dateStr, timeStr, bill.bill_number, item.item_name, previousStock, item.quantity, newStock, 'Bill Voided']
        );
      }
    }

    await client.query(
      `UPDATE bills SET status = 'voided', void_reason = $1 WHERE id = $2`,
      [reason || 'No reason provided', id]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
