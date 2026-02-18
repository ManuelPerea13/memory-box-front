// Usar host actual del navegador en dev para que funcione por IP (ej. 192.168.88.100)
const getDefaultApiUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/`;
  }
  return 'http://localhost:8000/';
};
const BASE_URL = process.env.REACT_APP_API_URL || getDefaultApiUrl();

const getHeaders = (authenticated = true) => {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  return headers;
};

const request = async (url, method = 'GET', data = null, authenticated = true) => {
  const config = {
    method,
    headers: getHeaders(authenticated),
    credentials: 'include',
  };
  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(data);
  }
  const response = await fetch(`${BASE_URL}${url}`, config);
  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return {};
};

const api = {
  baseUrl: BASE_URL,

  get(url, authenticated = true) {
    return request(url, 'GET', null, authenticated);
  },

  post(url, data, authenticated = true) {
    return request(url, 'POST', data, authenticated);
  },

  put(url, data) {
    return request(url, 'PUT', data);
  },

  patch(url, data) {
    return request(url, 'PATCH', data);
  },

  delete(url) {
    return request(url, 'DELETE');
  },

  authenticate(email, password) {
    return this.post('api/api-token-auth/', { email, password });
  },

  // Orders (backend: /api/orders/)
  getOrders() {
    return this.get('api/orders/');
  },

  getOrder(id) {
    return this.get(`api/orders/${id}/`, false);
  },

  createOrder(data) {
    return this.post('api/orders/', data, false);
  },

  updateOrder(id, data) {
    return this.put(`api/orders/${id}/`, data);
  },

  sendOrder(id) {
    return this.post(`api/orders/${id}/send_order/`, {});
  },

  // Image crops (backend: /api/image-crops/)
  getImageCrops(orderId) {
    return this.get(`api/image-crops/?order_id=${orderId}`, false);
  },

  createImageCrop(data) {
    return this.post('api/image-crops/', data);
  },

  updateImageCrop(id, data) {
    return this.put(`api/image-crops/${id}/`, data);
  },

  deleteImageCrop(id) {
    return this.delete(`api/image-crops/${id}/`);
  },
};

export default api;
