import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import * as db from './database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors());
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

// --- IMAGES API ---
app.post('/api/images/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: imageUrl });
});

app.get('/api/images/search', async (req, res) => {
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
    const { username, password } = req.body;
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      success: true,
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

app.post('/api/menu', async (req, res) => {
  try {
    const result = await db.addMenuItem(req.body);
    broadcastUpdate('menu_added');
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', async (req, res) => {
  try {
    const item = { ...req.body, id: req.params.id };
    await db.updateMenuItem(item);
    broadcastUpdate('menu_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    await db.deleteMenuItem(req.params.id);
    broadcastUpdate('menu_deleted');
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
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    await db.deleteBill(req.params.id);
    broadcastUpdate('bill_deleted');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY LOGS API ---
app.get('/api/inventory-logs', async (req, res) => {
  try {
    const logs = await db.getQuery(`SELECT * FROM inventory_logs ORDER BY date DESC, time DESC`);
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

// --- PURCHASES API ---
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await db.getPurchases();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const result = await db.addPurchaseItem(req.body);
    broadcastUpdate('purchase_added');
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchases/:id', async (req, res) => {
  try {
    const item = { ...req.body, id: req.params.id };
    await db.updatePurchaseItem(item);
    broadcastUpdate('purchase_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    await db.deletePurchaseItem(req.params.id);
    broadcastUpdate('purchase_deleted');
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

app.post('/api/categories', async (req, res) => {
  try {
    const result = await db.addCategory(req.body);
    broadcastUpdate('category_added');
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await db.deleteCategory(req.params.id);
    broadcastUpdate('category_deleted');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built frontend assets in production
const distDir = path.join(process.cwd(), '../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
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
