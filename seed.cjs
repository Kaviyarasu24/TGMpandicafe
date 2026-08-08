const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

// Simple helper to load backend/.env without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

let host = process.env.MYSQL_HOST;
let port = parseInt(process.env.MYSQL_PORT || '3306', 10);
let user = process.env.MYSQL_USER;
let password = process.env.MYSQL_PASSWORD || '';
let dbName = process.env.MYSQL_DATABASE || 'tgmcafe';

if (!host && process.env.DATABASE_URL) {
  try {
    const cleanConnectionString = process.env.DATABASE_URL.split('?')[0];
    const url = new URL(cleanConnectionString);
    host = url.hostname;
    port = parseInt(url.port || '3306', 10);
    user = url.username;
    password = url.password;
    dbName = url.pathname.replace(/^\//, '') || 'tgmcafe';
  } catch (e) {
    console.error("Failed to parse DATABASE_URL:", e.message);
    process.exit(1);
  }
} else if (!host && !user) {
  host = 'localhost';
  user = 'root';
  password = 'password';
  dbName = 'tgmcafe';
  port = 3306;
}

const serverConnectionOpts = {
  host,
  port,
  user,
  password
};

const setupConnection = mysql.createConnection(serverConnectionOpts);

setupConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL server to check database:', err.message);
    console.error('Please make sure your local MySQL server is running.');
    process.exit(1);
  }

  setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
    if (err) {
      console.error(`Error creating database ${dbName}:`, err.message);
      setupConnection.end();
      process.exit(1);
    }
    console.log(`Database "${dbName}" verified/created successfully.`);
    setupConnection.end();

    // Now connect to the database and seed it
    const dbConnectionOpts = {
      ...serverConnectionOpts,
      database: dbName
    };
    const connection = mysql.createConnection(dbConnectionOpts);
    connection.connect((err) => {
      if (err) {
        console.error('Error connecting to MySQL database:', err.message);
        process.exit(1);
      }
      console.log('Connected to MySQL database for seeding.');
      seedDb(connection);
    });
  });
});

const menuItems = [
  // HOT DRINKS
  { name: 'Tea', category: 'Hot Drinks', price: 20 },
  { name: 'Ginger Tea', category: 'Hot Drinks', price: 25 },
  { name: 'Yalaka Tea', category: 'Hot Drinks', price: 25 },
  { name: 'Coffee', category: 'Hot Drinks', price: 25 },
  { name: 'Black Tea', category: 'Hot Drinks', price: 15 },
  { name: 'Black Coffee', category: 'Hot Drinks', price: 20 },
  { name: 'Lemon Tea', category: 'Hot Drinks', price: 20 },
  { name: 'Boost', category: 'Hot Drinks', price: 40 },
  { name: 'Horlicks', category: 'Hot Drinks', price: 40 },
  { name: 'Green Tea', category: 'Hot Drinks', price: 30 },
  { name: 'Sukku Pal', category: 'Hot Drinks', price: 30 },
  { name: 'Badam Pal', category: 'Hot Drinks', price: 40 },
  { name: 'Pal', category: 'Hot Drinks', price: 20 },
  { name: 'Milo', category: 'Hot Drinks', price: 40 },

  // MILK SHAKE
  { name: 'Vanilla Milkshake', category: 'Milk Shake', price: 70 },
  { name: 'Chocolate Milkshake', category: 'Milk Shake', price: 80 },
  { name: 'Strawberry Milkshake', category: 'Milk Shake', price: 70 },
  { name: 'Butterscotch Milkshake', category: 'Milk Shake', price: 80 },
  { name: 'KitKat Milkshake', category: 'Milk Shake', price: 100 },
  { name: 'Brownie Milkshake', category: 'Milk Shake', price: 120 },
  { name: 'Oreo Milkshake', category: 'Milk Shake', price: 100 },

  // MOJITO
  { name: 'Blue Mojito', category: 'Mojito', price: 90 },
  { name: 'Lime mint Mojito', category: 'Mojito', price: 80 },
  { name: 'Watermelon Mojito', category: 'Mojito', price: 90 },

  // CHAT ITEMS
  { name: 'Pani Puri', category: 'Chat Items', price: 30 },
  { name: 'Masal Puri', category: 'Chat Items', price: 30 },
  { name: 'Kalan', category: 'Chat Items', price: 50 },
  { name: 'Cauliflower Chilli', category: 'Chat Items', price: 50 },
  { name: 'Chicken chill', category: 'Chat Items', price: 60 },

  // SCOPES
  { name: 'Vanilla Scope', category: 'Scopes', price: 40 },
  { name: 'Chocolate Scope', category: 'Scopes', price: 40 },
  { name: 'Strawberry Scope', category: 'Scopes', price: 40 },
  { name: 'Butterscotch Scope', category: 'Scopes', price: 40 },
  { name: 'Brownie Scope', category: 'Scopes', price: 60 },

  // JUICE
  { name: 'Apple Juice', category: 'Juice', price: 90 },
  { name: 'Orange Juice', category: 'Juice', price: 70 },
  { name: 'Pomegranate Juice', category: 'Juice', price: 70 },
  { name: 'Mosambi Juice', category: 'Juice', price: 40 },
  { name: 'Muskmelon Juice', category: 'Juice', price: 30 },
  { name: 'Watermelon Juice', category: 'Juice', price: 30 },
  { name: 'Lemon Juice', category: 'Juice', price: 20 },

  // COOLING
  { name: 'Cold Coffee', category: 'Cooling', price: 70 },
  { name: 'Rose Milk', category: 'Cooling', price: 30 },
  { name: 'Badam milk', category: 'Cooling', price: 30 },
  { name: 'Boost (Cold)', category: 'Cooling', price: 50 },
  { name: 'Horlicks (Cold)', category: 'Cooling', price: 50 },
  { name: 'Nannari Sharbat', category: 'Cooling', price: 30 },

  // STARTER (VEG)
  { name: 'French Fries', category: 'Starter (Veg)', price: 70 },
  { name: 'Peri Peri Fries', category: 'Starter (Veg)', price: 80 },
  { name: 'Cheese Balls (6)', category: 'Starter (Veg)', price: 80 },
  { name: 'Veg Samosa (3)', category: 'Starter (Veg)', price: 60 },
  { name: 'Veg Momos (6)', category: 'Starter (Veg)', price: 80 },
  { name: 'Paneer Momos (6)', category: 'Starter (Veg)', price: 120 },
  { name: 'Veg Cutlet (2)', category: 'Starter (Veg)', price: 100 },

  // RICE & NOODLE ITEMS
  { name: 'Veg Rice', category: 'Rice & Noodle', price: 70 },
  { name: 'Egg Rice', category: 'Rice & Noodle', price: 80 },
  { name: 'Chicken Rice', category: 'Rice & Noodle', price: 100 },
  { name: 'Veg Noodle', category: 'Rice & Noodle', price: 70 },
  { name: 'Egg Noodle', category: 'Rice & Noodle', price: 80 },
  { name: 'Chicken Noodle', category: 'Rice & Noodle', price: 100 },

  // STARTER (NON - VEG)
  { name: 'Chicken Momos (6)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Chicken Pops (10)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Chicken Nuggets (6)', category: 'Starter (Non-Veg)', price: 80 },
  { name: 'Chicken Cutlet (2)', category: 'Starter (Non-Veg)', price: 40 },
  { name: 'Chicken Strips (5)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Spicy Wings (4)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Fish Finger (4)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Chicken Lollipop (4)', category: 'Starter (Non-Veg)', price: 100 },
  { name: 'Chicken Bites (6)', category: 'Starter (Non-Veg)', price: 100 },
];

function seedDb(connection) {
  const createTableQuery = `CREATE TABLE IF NOT EXISTS menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_count INT NOT NULL,
    min_stock INT NOT NULL DEFAULT 10,
    image_url TEXT
  )`;

  connection.query(createTableQuery, (err) => {
    if (err) {
      console.error("Error creating menu table:", err.message);
      connection.end();
      process.exit(1);
    }

    connection.query("DELETE FROM menu", (err) => {
      if (err) {
        console.error("Error clearing old menu:", err.message);
        connection.end();
        process.exit(1);
      }

      const stmt = "INSERT INTO menu (name, category, price, stock_count, min_stock) VALUES (?, ?, ?, ?, ?)";
      let completed = 0;

      menuItems.forEach(item => {
        connection.query(stmt, [item.name, item.category, item.price, 100, 10], (err) => {
          if (err) {
            console.error(`Error inserting ${item.name}:`, err.message);
          }
          completed++;
          if (completed === menuItems.length) {
            console.log(`Successfully seeded ${menuItems.length} menu items into MySQL!`);
            connection.end();
            process.exit(0);
          }
        });
      });
    });
  });
}
