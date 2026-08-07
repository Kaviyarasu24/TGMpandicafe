import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL environment variable is not set. The backend cannot connect to MySQL. Exiting.');
  process.exit(1);
}

const cleanConnectionString = connectionString.split('?')[0];

const pool = mysql.createPool({
  uri: cleanConnectionString,
  decimalAsNumber: true,
  typeCast: function (field, next) {
    if (field.type === 'DECIMAL' || field.type === 'NEWDECIMAL') {
      const value = field.string();
      return (value === null) ? null : parseFloat(value);
    }
    return next();
  }
});

// Round a monetary value to 2 decimal places (paise precision) on write
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const initDb = async () => {
  try {
    console.log(`Initializing MySQL Database...`);
    await createTables();
  } catch (err) {
    console.error('Error initializing MySQL database:', err.message);
  }
};

const createTables = async () => {
  // Menu Table
  await pool.query(`CREATE TABLE IF NOT EXISTS menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_count INT NOT NULL,
    min_stock INT NOT NULL DEFAULT 10,
    image_url TEXT
  )`);

  // Bills Table
  await pool.query(`CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_number VARCHAR(255) NOT NULL UNIQUE,
    date_time VARCHAR(255) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    void_reason TEXT
  )`);

  // Bill Items Table
  await pool.query(`CREATE TABLE IF NOT EXISTS bill_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    date VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    category VARCHAR(255) NOT NULL
  )`);

  // Inventory Logs Table
  await pool.query(`CREATE TABLE IF NOT EXISTS inventory_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    pricing_type VARCHAR(50) NOT NULL,
    weight_unit VARCHAR(50)
  )`);

  // Users Table
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    mobile VARCHAR(50),
    theme VARCHAR(50) DEFAULT 'light'
  )`);

  // Audit Logs Table
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(255),
    role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details TEXT
  )`);

  // Held / Parked Orders Table
  await pool.query(`CREATE TABLE IF NOT EXISTS held_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    label VARCHAR(255) NOT NULL,
    created_by VARCHAR(255),
    cart_data JSON NOT NULL
  )`);

  // Seed default categories
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
      `INSERT INTO categories (name, pricing_type, weight_unit) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pricing_type=VALUES(pricing_type), weight_unit=VALUES(weight_unit)`,
      [c.name, c.pricing, c.unit]
    );
  }

  // Seed default admin and sales users
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (parseInt(rows[0].count, 10) === 0) {
    const defaultPassword = 'password';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    
    await pool.query(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=username`, ['admin', hash, 'admin', 'System Administrator']);
    await pool.query(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=username`, ['sales', hash, 'sales', 'Sales Staff']);
    console.log('Default users seeded.');
  }
};

// Initialize DB immediately on start
initDb();

export const runQuery = async (query, params = []) => {
  const [result] = await pool.query(query, params);
  const insertedId = result.insertId || null;
  return { id: insertedId, changes: result.affectedRows || 0 };
};

export const getQuery = async (query, params = []) => {
  const [rows] = await pool.query(query, params);
  return rows;
};

export const getSingleQuery = async (query, params = []) => {
  const [rows] = await pool.query(query, params);
  return rows[0] || null;
};

// --- MENU OPERATIONS ---

export const getMenu = async () => {
  return await getQuery(`SELECT id, name, category, price, stock_count, min_stock, image_url FROM menu ORDER BY category, name`);
};

export const addMenuItem = async (item) => {
  return await runQuery(
    `INSERT INTO menu (name, category, price, stock_count, min_stock, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
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
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = await pool.getConnection();
    try {
      await client.beginTransaction();

      const dateStr = billData.date.replace(/-/g, '');
      const datePrefix = `${dateStr}-%`;

      // Calculate max daily sequence number from bills
      const [maxBillRes] = await client.query(
        `SELECT MAX(CAST(SUBSTRING(bill_number, 13) AS SIGNED)) as max_num FROM bills WHERE bill_number LIKE ?`,
        [`BL-${datePrefix}`]
      );

      // Calculate max daily sequence number from deleted bills in inventory_logs
      const [maxLogRes] = await client.query(
        `SELECT MAX(CAST(SUBSTRING(bill_number, 13) AS SIGNED)) as max_num FROM inventory_logs WHERE bill_number LIKE ? AND action = 'Bill Deleted'`,
        [`BL-${datePrefix}`]
      );

      const maxFromBills = maxBillRes[0]?.max_num || 0;
      const maxFromLogs = maxLogRes[0]?.max_num || 0;
      const nextSequence = Math.max(maxFromBills, maxFromLogs, 0) + attempt;

      const finalBillNumber = `BL-${dateStr}-${nextSequence.toString().padStart(4, '0')}`;

      const [billInsert] = await client.query(
        `INSERT INTO bills (bill_number, date_time, subtotal, tax, total, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
        [finalBillNumber, `${billData.date}T${billData.time}`, round2(billData.subtotal), round2(billData.tax), round2(billData.total), billData.payment_method]
      );
      const billId = billInsert.insertId;

      for (const item of billData.items) {
        await client.query(
          `INSERT INTO bill_items (bill_id, item_id, item_name, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`,
          [billId, item.id, item.name, item.quantity, item.price, round2(item.quantity * item.price)]
        );

        await client.query(
          `UPDATE menu SET stock_count = stock_count - ? WHERE id = ?`,
          [item.quantity, item.id]
        );
      }

      await client.commit();
      return { success: true, billNumber: finalBillNumber };
    } catch (err) {
      await client.rollback();
      // 1062 = duplicate entry. Retry with a bumped sequence if attempts remain.
      if (err.errno === 1062 && attempt < MAX_ATTEMPTS) {
        client.release();
        continue;
      }
      client.release();
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

  const billIds = bills.map((b) => b.id);
  const placeholders = billIds.map(() => '?').join(', ');
  const allItems = await getQuery(
    `SELECT id, bill_id, item_id, item_name, quantity, price, total FROM bill_items WHERE bill_id IN (${placeholders})`,
    billIds
  );

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
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();

    const [billRes] = await client.query(`SELECT * FROM bills WHERE id = ?`, [id]);
    const bill = billRes[0];
    if (!bill) {
      throw new Error("Bill not found or already deleted");
    }

    const [itemsRes] = await client.query(`SELECT * FROM bill_items WHERE bill_id = ?`, [id]);
    const items = itemsRes;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    for (const item of items) {
      const [menuRes] = await client.query(`SELECT stock_count FROM menu WHERE id = ?`, [item.item_id]);
      const menuRow = menuRes[0];
      if (menuRow) {
        const previousStock = menuRow.stock_count;
        const newStock = previousStock + item.quantity;
        
        await client.query(`UPDATE menu SET stock_count = ? WHERE id = ?`, [newStock, item.item_id]);

        await client.query(
          `INSERT INTO inventory_logs (date, time, bill_number, item_name, previous_stock, restored_quantity, updated_stock, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [dateStr, timeStr, bill.bill_number, item.item_name, previousStock, item.quantity, newStock, 'Bill Deleted']
        );
      }
    }

    await client.query(`DELETE FROM bill_items WHERE bill_id = ?`, [id]);
    await client.query(`DELETE FROM bills WHERE id = ?`, [id]);

    await client.commit();
    return { success: true };
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }
};

export const updateBill = async (billData) => {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();

    const [oldItemsRes] = await client.query(`SELECT * FROM bill_items WHERE bill_id = ?`, [billData.id]);
    const oldItems = oldItemsRes;
    for (const item of oldItems) {
      await client.query(`UPDATE menu SET stock_count = stock_count + ? WHERE id = ?`, [item.quantity, item.item_id]);
    }

    await client.query(`DELETE FROM bill_items WHERE bill_id = ?`, [billData.id]);

    await client.query(
      `UPDATE bills SET subtotal = ?, tax = ?, total = ?, payment_method = ? WHERE id = ?`,
      [round2(billData.subtotal), round2(billData.tax), round2(billData.total), billData.payment_method, billData.id]
    );

    for (const item of billData.items) {
      await client.query(
        `INSERT INTO bill_items (bill_id, item_id, item_name, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`,
        [billData.id, item.id, item.name, item.quantity, item.price, round2(item.quantity * item.price)]
      );

      await client.query(
        `UPDATE menu SET stock_count = stock_count - ? WHERE id = ?`,
        [item.quantity, item.id]
      );
    }

    await client.commit();
    return { success: true };
  } catch (err) {
    await client.rollback();
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
    `INSERT INTO purchases (date, description, quantity, price, total, category) VALUES (?, ?, ?, ?, ?, ?)`,
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
    `INSERT INTO categories (name, pricing_type, weight_unit) VALUES (?, ?, ?)`,
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
    `INSERT INTO users (username, password_hash, role, full_name, email, mobile, theme) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
      `INSERT INTO audit_logs (username, role, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [username || null, role || null, action, entity, entity_id != null ? String(entity_id) : null, details || null]
    );
  } catch (err) {
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
    `INSERT INTO held_orders (label, created_by, cart_data) VALUES (?, ?, ?)`,
    [label, created_by || null, JSON.stringify(cart_data)]
  );
};

export const deleteHeldOrder = async (id) => {
  return await runQuery(`DELETE FROM held_orders WHERE id = ?`, [id]);
};

// --- VOID BILL OPERATION ---

export const voidBill = async (id, reason) => {
  const client = await pool.getConnection();
  try {
    await client.beginTransaction();

    const [billRes] = await client.query(`SELECT * FROM bills WHERE id = ?`, [id]);
    const bill = billRes[0];
    if (!bill) {
      throw new Error('Bill not found');
    }
    if (bill.status === 'voided') {
      throw new Error('Bill is already voided');
    }

    const [itemsRes] = await client.query(`SELECT * FROM bill_items WHERE bill_id = ?`, [id]);
    const items = itemsRes;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    for (const item of items) {
      const [menuRes] = await client.query(`SELECT stock_count FROM menu WHERE id = ?`, [item.item_id]);
      const menuRow = menuRes[0];
      if (menuRow) {
        const previousStock = menuRow.stock_count;
        const newStock = previousStock + item.quantity;
        await client.query(`UPDATE menu SET stock_count = ? WHERE id = ?`, [newStock, item.item_id]);
        await client.query(
          `INSERT INTO inventory_logs (date, time, bill_number, item_name, previous_stock, restored_quantity, updated_stock, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [dateStr, timeStr, bill.bill_number, item.item_name, previousStock, item.quantity, newStock, 'Bill Voided']
        );
      }
    }

    await client.query(
      `UPDATE bills SET status = 'voided', void_reason = ? WHERE id = ?`,
      [reason || 'No reason provided', id]
    );

    await client.commit();
    return { success: true };
  } catch (err) {
    await client.rollback();
    throw err;
  } finally {
    client.release();
  }
};
