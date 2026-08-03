import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://tgmpandicafe.onrender.com'
);

// Initialize socket.io-client for real-time synchronization
export const socket = io(API_BASE_URL);

const sortMenuItems = (items) => {
  if (!Array.isArray(items)) return items;
  return [...items].sort((a, b) => {
    // 1. Sort by category first (maintain alphabetical order of categories)
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    
    // 2. Custom sorting for Hot Drinks category
    if (a.category === 'Hot Drinks') {
      const order = ['Tea', 'Black Tea', 'Coffee', 'Black Coffee'];
      const indexA = order.indexOf(a.name);
      const indexB = order.indexOf(b.name);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // Other hot drinks are sorted alphabetically
      return a.name.localeCompare(b.name);
    }
    
    // 3. Alphabetical sorting by name for other categories
    return a.name.localeCompare(b.name);
  });
};

export const api = {
  // --- MENU ---
  getMenu: async () => {
    const res = await fetch(`${API_BASE_URL}/api/menu`);
    if (!res.ok) throw new Error('Failed to fetch menu');
    const data = await res.json();
    return sortMenuItems(data);
  },
  addMenuItem: async (item) => {
    const res = await fetch(`${API_BASE_URL}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        stock_count: parseInt(item.stock_count) || 0,
        min_stock: parseInt(item.min_stock) || 10,
        image_url: item.image_url || null
      })
    });
    if (!res.ok) throw new Error('Failed to add menu item');
    return await res.json();
  },
  updateMenuItem: async (item) => {
    const res = await fetch(`${API_BASE_URL}/api/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        stock_count: parseInt(item.stock_count) || 0,
        min_stock: parseInt(item.min_stock) || 10,
        image_url: item.image_url || null
      })
    });
    if (!res.ok) throw new Error('Failed to update menu item');
    return await res.json();
  },
  deleteMenuItem: async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/menu/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete menu item');
    return await res.json();
  },
  
  // --- BILLING ---
  createBill: async (billData) => {
    const res = await fetch(`${API_BASE_URL}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData)
    });
    if (!res.ok) throw new Error('Failed to create bill');
    return await res.json();
  },
  getBills: async () => {
    const res = await fetch(`${API_BASE_URL}/api/bills`);
    if (!res.ok) throw new Error('Failed to fetch bills');
    return await res.json();
  },
  updateBill: async (billData) => {
    const res = await fetch(`${API_BASE_URL}/api/bills/${billData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData)
    });
    if (!res.ok) throw new Error('Failed to update bill');
    return await res.json();
  },
  deleteBill: async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/bills/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete bill');
    return await res.json();
  },
  
  getDashboardStats: async () => {
    const res = await fetch(`${API_BASE_URL}/api/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  },
  
  // --- PURCHASES ---
  getPurchases: async () => {
    const res = await fetch(`${API_BASE_URL}/api/purchases`);
    if (!res.ok) throw new Error('Failed to fetch purchases');
    return await res.json();
  },
  addPurchaseItem: async (item) => {
    const res = await fetch(`${API_BASE_URL}/api/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to add purchase');
    return await res.json();
  },
  updatePurchaseItem: async (item) => {
    const res = await fetch(`${API_BASE_URL}/api/purchases/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to update purchase');
    return await res.json();
  },
  deletePurchaseItem: async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/purchases/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete purchase');
    return await res.json();
  },
  
  // --- CATEGORIES ---
  getCategories: async () => {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return await res.json();
  },
  addCategory: async (cat) => {
    const res = await fetch(`${API_BASE_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat)
    });
    if (!res.ok) throw new Error('Failed to add category');
    return await res.json();
  },
  deleteCategory: async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
    return await res.json();
  },
  
  // --- IMAGES ---
  searchImages: async (query) => {
    const res = await fetch(`${API_BASE_URL}/api/images/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to fetch images');
    return await res.json();
  },
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/api/images/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload image');
    return await res.json();
  },
  
  // --- USERS ---
  getUsers: async () => {
    const res = await fetch(`${API_BASE_URL}/api/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  },
  addUser: async (user) => {
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to add user');
    return await res.json();
  },
  updateUser: async (user) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to update user');
    return await res.json();
  },
  deleteUser: async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return await res.json();
  }
};
