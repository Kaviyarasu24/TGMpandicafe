import { io } from 'socket.io-client';
import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://tgmpandicafe.onrender.com'
);

// Initialize socket.io-client for real-time synchronization
export const socket = io(API_BASE_URL);

// Create Axios Instance
export const apiInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Request Interceptor: Attach token if it exists
apiInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401/403 errors globally
apiInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('username');
      localStorage.removeItem('full_name');
      
      // Dispatch event for reactive UI updates
      window.dispatchEvent(new Event('auth-logout'));
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

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
  // --- AUTH & VALIDATION ---
  verifyToken: async (token) => {
    const res = await apiInstance.get('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  },

  // --- MENU ---
  getMenu: async () => {
    const res = await apiInstance.get('/api/menu');
    return sortMenuItems(res.data);
  },
  addMenuItem: async (item) => {
    const res = await apiInstance.post('/api/menu', {
      name: item.name,
      category: item.category,
      price: parseFloat(item.price),
      stock_count: parseInt(item.stock_count) || 0,
      min_stock: parseInt(item.min_stock) || 10,
      image_url: item.image_url || null
    });
    return res.data;
  },
  updateMenuItem: async (item) => {
    const res = await apiInstance.put(`/api/menu/${item.id}`, {
      id: item.id,
      name: item.name,
      category: item.category,
      price: parseFloat(item.price),
      stock_count: parseInt(item.stock_count) || 0,
      min_stock: parseInt(item.min_stock) || 10,
      image_url: item.image_url || null
    });
    return res.data;
  },
  deleteMenuItem: async (id) => {
    const res = await apiInstance.delete(`/api/menu/${id}`);
    return res.data;
  },
  
  // --- BILLING ---
  createBill: async (billData) => {
    const res = await apiInstance.post('/api/bills', billData);
    return res.data;
  },
  getBills: async () => {
    const res = await apiInstance.get('/api/bills');
    return res.data;
  },
  updateBill: async (billData) => {
    const res = await apiInstance.put(`/api/bills/${billData.id}`, billData);
    return res.data;
  },
  deleteBill: async (id) => {
    const res = await apiInstance.delete(`/api/bills/${id}`);
    return res.data;
  },
  voidBill: async (id, reason) => {
    const res = await apiInstance.post(`/api/bills/${id}/void`, { reason });
    return res.data;
  },

  // --- HELD / PARKED ORDERS ---
  getHeldOrders: async () => {
    const res = await apiInstance.get('/api/held-orders');
    return res.data;
  },
  addHeldOrder: async (label, cartData) => {
    const res = await apiInstance.post('/api/held-orders', { label, cart_data: cartData });
    return res.data;
  },
  deleteHeldOrder: async (id) => {
    const res = await apiInstance.delete(`/api/held-orders/${id}`);
    return res.data;
  },
  
  getDashboardStats: async () => {
    const res = await apiInstance.get('/api/stats');
    return res.data;
  },
  
  // --- PURCHASES ---
  getPurchases: async () => {
    const res = await apiInstance.get('/api/purchases');
    return res.data;
  },
  addPurchaseItem: async (item) => {
    const res = await apiInstance.post('/api/purchases', item);
    return res.data;
  },
  updatePurchaseItem: async (item) => {
    const res = await apiInstance.put(`/api/purchases/${item.id}`, item);
    return res.data;
  },
  deletePurchaseItem: async (id) => {
    const res = await apiInstance.delete(`/api/purchases/${id}`);
    return res.data;
  },
  
  // --- CATEGORIES ---
  getCategories: async () => {
    const res = await apiInstance.get('/api/categories');
    return res.data;
  },
  addCategory: async (cat) => {
    const res = await apiInstance.post('/api/categories', cat);
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await apiInstance.delete(`/api/categories/${id}`);
    return res.data;
  },
  
  // --- IMAGES ---
  searchImages: async (query) => {
    const res = await apiInstance.get(`/api/images/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiInstance.post('/api/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  
  // --- USERS ---
  getUsers: async () => {
    const res = await apiInstance.get('/api/users');
    return res.data;
  },
  addUser: async (user) => {
    const res = await apiInstance.post('/api/users', user);
    return res.data;
  },
  updateUser: async (user) => {
    const res = await apiInstance.put(`/api/users/${user.id}`, user);
    return res.data;
  },
  deleteUser: async (id) => {
    const res = await apiInstance.delete(`/api/users/${id}`);
    return res.data;
  },

  // --- AUDIT LOGS (admin-only) ---
  getAuditLogs: async ({ limit = 100, offset = 0 } = {}) => {
    const res = await apiInstance.get(`/api/audit-logs?limit=${limit}&offset=${offset}`);
    return res.data;
  }
};
