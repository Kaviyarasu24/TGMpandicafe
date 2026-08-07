import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from './database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Centralized JWT secret. In production a missing secret is fatal (fail-fast) so a
// misconfigured deployment cannot silently run on a shared, guessable default. In
// development we fall back to a dev-only secret with a loud warning so local runs work.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET is not set. Refusing to start in production with an insecure default. Set JWT_SECRET in the environment.');
    process.exit(1);
  }
  console.warn('[SECURITY WARNING] JWT_SECRET is not set. Using an insecure development default. Set JWT_SECRET before deploying to production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-change-in-production';

// Simple in-memory brute-force guard for the login endpoint.
// Tracks failed attempts per IP within a rolling window. No external dependency.
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map(); // ip -> { count, firstAttempt }

const recordLoginFailure = (ip) => {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
};

const clearLoginFailures = (ip) => loginAttempts.delete(ip);

const isLoginBlocked = (ip) => {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
};

// Server-side password policy. Mirrors the strong-password rule enforced in the
// sales settings UI so the API cannot be bypassed by calling it directly.
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const validatePasswordStrength = (password) => {
  if (!password || !STRONG_PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters and contain 1 uppercase, 1 lowercase, 1 number, and 1 special character.';
  }
  return null;
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

const app = express();
// Trust the first proxy hop (Render/hosting) so req.ip reflects the real
// client address via X-Forwarded-For. Required for per-client rate limiting.
app.set('trust proxy', 1);
const httpServer = createServer(app);

// CORS allowlist. Set ALLOWED_ORIGINS to a comma-separated list of frontend origins
// (e.g. "https://tgmpandicafe.vercel.app,http://localhost:5173") to lock the API down.
// If unset we stay permissive (current behavior) but warn loudly, so the cross-origin
// Vercel->Render deploy keeps working until the operator sets the env var.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : null;
if (!allowedOrigins) {
  console.warn('[SECURITY WARNING] ALLOWED_ORIGINS is not set. CORS is open to all origins. Set ALLOWED_ORIGINS to lock the API to your frontend origin(s).');
}
// When an allowlist is configured, permit requests with no Origin header
// (curl, server-to-server, same-origin) and any explicitly listed origin.
const corsOrigin = allowedOrigins
  ? (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    }
  : '*';
const corsOptions = { origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'] };

const io = new Server(httpServer, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Serve uploaded images

// --- WEBSOCKETS ---
io.on('connection', (socket) => {
  console.log('A device connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id);
  });
});

const broadcastUpdate = (action) => {
  io.emit('database_update', { action, timestamp: Date.now() });
};

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// Apply JWT verification globally to all /api routes except login
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/login/') {
    return next();
  }
  authenticateToken(req, res, next);
});

// Role gate: require an admin token. Mirrors the frontend's admin-only route gating
// (ProtectedRoute requireAdmin) so the API cannot be bypassed by a sales token calling
// admin endpoints directly. Runs after the global authenticateToken guard, so req.user
// is already populated.
const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin privileges required' });
};

// Fire-and-forget audit trail helper. db.addAuditLog swallows its own errors, so a
// logging failure can never break the primary request. Captures the acting user from
// the verified JWT (req.user), so it cannot be spoofed by the request body.
const audit = (req, action, entity, entityId, details) =>
  db.addAuditLog({
    username: req.user?.username,
    role: req.user?.role,
    action,
    entity,
    entity_id: entityId,
    details
  });

// --- IMAGES API --- (admin-only: used by the Menu Manager)
app.post('/api/images/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: imageUrl });
});

app.get('/api/images/search', requireAdmin, async (req, res) => {
  try {
    let query = req.query.q || '';
    
    // Smart Keyword Matching
    const kwMap = {
      'chicken 65': 'fried chicken',
      'chicken chill': 'spicy chicken',
      'tea': 'indian tea',
      'coffee': 'cup of coffee',
      'cold coffee': 'iced coffee',
      'boost': 'chocolate milk',
      'boost (cold)': 'iced chocolate',
      'horlicks': 'hot milk',
      'horlicks (cold)': 'glass of milk',
      'puffs': 'bakery puff',
      'veg puff': 'bakery puff',
      'egg puff': 'bakery puff',
      'samosa': 'indian samosa',
      'biryani': 'indian biryani',
      'chicken biryani': 'indian biryani',
      'veg fried rice': 'veg fried rice',
      'chicken fried rice': 'chicken fried rice',
      'egg rice': 'egg fried rice',
      'chicken rice': 'chicken fried rice',
      'egg noodle': 'egg noodles',
      'chicken noodle': 'chicken noodles',
      'veg noodle': 'chow mein',
      'strawberry scope': 'strawberry ice cream',
      'vanilla scope': 'vanilla ice cream',
      'chocolate scope': 'chocolate ice cream',
      'pal': 'glass of milk',
      'french fries': 'plate of french fries',
      'laddu': 'indian sweet',
      'mysore pak': 'indian dessert',
      'gulab jamun': 'indian sweet dessert',
      'murukku': 'south indian snack',
      'mixture': 'snack mix',
      'badam milk': 'almond milk',
      'ice cream': 'ice cream',
      'milk': 'glass of milk'
    };
    
    query = kwMap[query.toLowerCase()] || query;

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'PEXELS_API_KEY is not configured in backend/.env' });
    }

    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape`, {
      headers: { Authorization: apiKey }
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data.photos || []);
  } catch (err) {
    console.error('Image search error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// --- AUTH & USER API ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Brute-force protection: check if this IP is blocked
    if (isLoginBlocked(clientIp)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    const { username, password } = req.body;
    const user = await db.getUserByUsername(username);

    if (!user) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Successful login: clear any tracked failures for this IP
    clearLoginFailures(clientIp);

    const token = jwt.sign(
      {
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        theme: user.theme
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        theme: user.theme
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/verify', (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

app.put('/api/user/password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Enforce password policy server-side (cannot be bypassed via direct API calls)
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    
    await db.updateUserPassword(username, hash);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', async (req, res) => {
  try {
    const { username, ...profileData } = req.body;
    await db.updateUserProfile(username, profileData);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MENU API ---
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await db.getMenu();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', requireAdmin, async (req, res) => {
  try {
    const result = await db.addMenuItem(req.body);
    broadcastUpdate('menu_added');
    await audit(req, 'create', 'menu', result.id, req.body.name);
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', requireAdmin, async (req, res) => {
  try {
    const item = { ...req.body, id: req.params.id };
    await db.updateMenuItem(item);
    broadcastUpdate('menu_updated');
    await audit(req, 'update', 'menu', req.params.id, req.body.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteMenuItem(req.params.id);
    broadcastUpdate('menu_deleted');
    await audit(req, 'delete', 'menu', req.params.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BILLING API ---
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await db.getBills();
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', async (req, res) => {
  try {
    const result = await db.createBill(req.body);
    broadcastUpdate('bill_created');
    await audit(req, 'create', 'bill', result.billNumber, `Total ₹${req.body.total}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const billData = { ...req.body, id: req.params.id };
    const result = await db.updateBill(billData);
    broadcastUpdate('bill_updated');
    await audit(req, 'update', 'bill', req.params.id, `Total ₹${req.body.total}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    await db.deleteBill(req.params.id);
    broadcastUpdate('bill_deleted');
    await audit(req, 'delete', 'bill', req.params.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Void a bill (soft, recoverable): restores stock and marks status='voided' instead
// of hard-deleting. Available to any authenticated user, like delete.
app.post('/api/bills/:id/void', async (req, res) => {
  try {
    await db.voidBill(req.params.id, req.body.reason);
    broadcastUpdate('bill_voided');
    await audit(req, 'void', 'bill', req.params.id, req.body.reason || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HELD / PARKED ORDERS API --- (any authenticated user; cashiers park carts)
app.get('/api/held-orders', async (req, res) => {
  try {
    const orders = await db.getHeldOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/held-orders', async (req, res) => {
  try {
    const result = await db.addHeldOrder({
      label: req.body.label,
      created_by: req.user?.username,
      cart_data: req.body.cart_data
    });
    broadcastUpdate('held_order_added');
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/held-orders/:id', async (req, res) => {
  try {
    await db.deleteHeldOrder(req.params.id);
    broadcastUpdate('held_order_deleted');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY LOGS API --- (admin-only)
app.get('/api/inventory-logs', requireAdmin, async (req, res) => {
  try {
    const logs = await db.getQuery(`SELECT * FROM inventory_logs ORDER BY date DESC, time DESC`);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUDIT LOG API --- (admin-only): read-only activity trail of who changed what.
app.get('/api/audit-logs', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const logs = await db.getAuditLogs({ limit, offset });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DASHBOARD API ---
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PURCHASES API --- (admin-only)
app.get('/api/purchases', requireAdmin, async (req, res) => {
  try {
    const purchases = await db.getPurchases();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', requireAdmin, async (req, res) => {
  try {
    const result = await db.addPurchaseItem(req.body);
    broadcastUpdate('purchase_added');
    await audit(req, 'create', 'purchase', result.id, req.body.description);
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchases/:id', requireAdmin, async (req, res) => {
  try {
    const item = { ...req.body, id: req.params.id };
    await db.updatePurchaseItem(item);
    broadcastUpdate('purchase_updated');
    await audit(req, 'update', 'purchase', req.params.id, req.body.description);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/purchases/:id', requireAdmin, async (req, res) => {
  try {
    await db.deletePurchaseItem(req.params.id);
    broadcastUpdate('purchase_deleted');
    await audit(req, 'delete', 'purchase', req.params.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATEGORIES API ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    const result = await db.addCategory(req.body);
    broadcastUpdate('category_added');
    await audit(req, 'create', 'category', result.id, req.body.name);
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteCategory(req.params.id);
    broadcastUpdate('category_deleted');
    await audit(req, 'delete', 'category', req.params.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USERS MANAGEMENT API --- (admin-only)
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    // Enforce password policy server-side when creating users
    if (req.body.password) {
      const strengthError = validatePasswordStrength(req.body.password);
      if (strengthError) {
        return res.status(400).json({ error: strengthError });
      }
    }
    const result = await db.addUser(req.body);
    broadcastUpdate('user_added');
    await audit(req, 'create', 'user', result.id, `${req.body.username} (${req.body.role})`);
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    await db.updateUser(req.params.id, req.body);
    broadcastUpdate('user_updated');
    await audit(req, 'update', 'user', req.params.id, req.body.username || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteUser(req.params.id);
    broadcastUpdate('user_deleted');
    await audit(req, 'delete', 'user', req.params.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built frontend assets in production
const distDir = path.join(process.cwd(), '../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*any', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Local Server running on http://localhost:${PORT}`);
});
