import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/admin';
const API_TOKEN = 'beta-admin-secret-123'; // Pode ser movido para .env

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'X-Admin-Token': API_TOKEN }
});
