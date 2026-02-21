// En prod se inyecta REACT_APP_API_URL en build; en dev usamos host actual
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/`;
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:8000/';
};
// Si REACT_APP_API_URL es solo "/" usamos origen actual (mismo host); las rutas ya llevan "api/"
const BASE_URL = process.env.REACT_APP_API_URL === '/' || process.env.REACT_APP_API_URL === ''
  ? '/'
  : process.env.REACT_APP_API_URL
    ? (process.env.REACT_APP_API_URL.replace(/\/$/, '') + '/')
    : getBaseUrl();

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

  put(url, data, authenticated = true) {
    return request(url, 'PUT', data, authenticated);
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
  getOrders(includeHidden = false) {
    const qs = includeHidden ? '?include_hidden=1' : '';
    return this.get(`api/orders/${qs}`);
  },

  getOrder(id) {
    return this.get(`api/orders/${id}/`, false);
  },

  createOrder(data) {
    return this.post('api/orders/', data, false);
  },

  updateOrder(id, data) {
    return this.put(`api/orders/${id}/`, data, false);
  },

  patchOrder(id, data) {
    return this.patch(`api/orders/${id}/`, data);
  },

  sendOrder(id) {
    return this.post(`api/orders/${id}/send_order/`, {}, false);
  },

  submitOrderImages(orderId, formData) {
    return fetch(`${BASE_URL}api/orders/${orderId}/submit_images/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }
      return res.json();
    });
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

  /** Replace image for an existing crop (admin). Sends multipart with image file. orderId required so backend can resolve the crop. */
  replaceImageCrop(cropId, orderId, file) {
    const formData = new FormData();
    formData.append('image', file);
    const headers = {};
    const authToken = localStorage.getItem('authToken');
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const url = `${BASE_URL}api/image-crops/${cropId}/?order_id=${encodeURIComponent(orderId)}`;
    return fetch(url, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.image || `Error ${res.status}`);
      }
      return res.json();
    });
  },

  deleteImageCrop(id) {
    return this.delete(`api/image-crops/${id}/`);
  },

  // Stock (admin)
  getStock() {
    return this.get('api/stock/');
  },

  addStock(variant, boxType, amount) {
    return this.post('api/stock/add_stock/', { variant, box_type: boxType, amount });
  },

  setStock(variant, boxType, quantity) {
    return this.post('api/stock/set_stock/', { variant, box_type: boxType, quantity });
  },

  // Precios y datos de transferencia (público GET; PATCH con auth)
  getPrices(authenticated = false) {
    return this.get('api/settings/prices/', authenticated);
  },

  updatePrices(data) {
    return this.patch('api/settings/prices/', data);
  },
};

export default api;
