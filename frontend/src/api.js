import axios from 'axios';

// Backend URL
const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for sending/receiving cookies
  headers: {
    'Content-Type': 'application/json',
  }
});

// --- Auth APIs ---
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (username, email, password) => api.post('/auth/register', { username, email, password });
export const getMe = () => api.get('/auth/get-me');
export const logout = () => api.get('/auth/logout');

// --- Chat APIs ---
export const getChats = () => api.get('/chat');
export const createChat = (title) => api.post('/chat', { title });
export const deleteChat = (chatId) => api.delete(`/chat/${chatId}`);

// --- Message APIs ---
export const getMessages = (chatId) => api.get(`/message/${chatId}`);

export const sendMessage = (chatId, content, provider = 'gemini', file = null) => {
  if (file) {
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('content', content);
    formData.append('provider', provider);
    formData.append('file', file);
    return api.post('/message', formData, {
      headers: {
        'Content-Type': undefined
      }
    });
  }
  return api.post('/message', { chatId, content, provider });
};
export const checkGrammar = (content, provider = 'gemini') =>
  api.post('/message/grammar-check', { content, provider });

export default api;
