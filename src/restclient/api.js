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

  /**
   * Download order images as ZIP (backend builds it; avoids fetch to /media/).
   * Returns { blob, filename }. Requires auth.
   */
  getOrderZip(orderId) {
    const url = `${BASE_URL}api/orders/${orderId}/download_zip/`;
    return fetch(url, {
      method: 'GET',
      headers: getHeaders(true),
      credentials: 'include',
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition');
      const match = disp && /filename="?([^"]+)"?/.exec(disp);
      const filename = match ? match[1].trim() : `order-${orderId}.zip`;
      return { blob, filename };
    });
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

  // Costos de referencia (admin; JSON en config)
  getCosts() {
    return this.get('api/settings/costs/');
  },

  updateCosts(data) {
    return this.patch('api/settings/costs/', data);
  },

  // Stock de packaging (cajas/bolsas). Se descuenta al finalizar pedidos.
  getPackaging() {
    return this.get('api/packaging/');
  },

  // Compras/gastos (registro variable)
  getPurchases() {
    return this.get('api/purchases/');
  },

  createPurchase(data) {
    return this.post('api/purchases/', data);
  },

  updatePurchase(id, data) {
    return this.patch(`api/purchases/${id}/`, data);
  },

  deletePurchase(id) {
    return this.delete(`api/purchases/${id}/`);
  },

  // Estadísticas (ventas por día/mes, resumen ventas vs costos)
  getEstadisticas(days = 30, months = 12) {
    const qs = `?days=${encodeURIComponent(days)}&months=${encodeURIComponent(months)}`;
    return this.get(`api/estadisticas/${qs}`);
  },

  // Video y música de fondo de la página principal (público GET; PATCH con auth)
  getHomeBackground(authenticated = false) {
    return this.get('api/settings/home-background/', authenticated);
  },

  updateHomeBackground(data) {
    return this.patch('api/settings/home-background/', data);
  },

  // Lista de videos/audios de fondo (admin)
  getBackgroundMedia(type = null) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.get(`api/settings/background-media/${qs}`);
  },

  createBackgroundMedia(formDataOrData) {
    if (formDataOrData instanceof FormData) {
      const headers = {};
      const authToken = localStorage.getItem('authToken');
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${this.baseUrl}api/settings/background-media/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw Object.assign(new Error(err.detail || err.file || 'Error al crear'), { data: err });
        }
        return res.json();
      });
    }
    return this.post('api/settings/background-media/', formDataOrData);
  },

  updateBackgroundMedia(id, formDataOrData) {
    if (formDataOrData instanceof FormData) {
      const headers = {};
      const authToken = localStorage.getItem('authToken');
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${this.baseUrl}api/settings/background-media/${id}/`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw Object.assign(new Error(err.detail || err.name || 'Error al actualizar'), { data: err });
        }
        return res.json();
      });
    }
    return this.patch(`api/settings/background-media/${id}/`, formDataOrData);
  },

  // Variantes de caja (público para ClientData; resto con auth)
  getVariantsPublic() {
    return this.get('api/settings/variants/public/', false);
  },

  getVariants() {
    return this.get('api/settings/variants/');
  },

  createVariant(data) {
    return this.post('api/settings/variants/', data);
  },

  updateVariant(id, data) {
    return this.patch(`api/settings/variants/${id}/`, data);
  },

  createVariantImage(formDataOrData) {
    if (formDataOrData instanceof FormData) {
      const headers = {};
      const authToken = localStorage.getItem('authToken');
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${this.baseUrl}api/settings/variant-images/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw Object.assign(new Error(err.detail || err.file || 'Error al crear'), { data: err });
        }
        return res.json();
      });
    }
    return this.post('api/settings/variant-images/', formDataOrData);
  },

  getVariantImages(variantId) {
    return this.get(`api/settings/variant-images/?variant_id=${encodeURIComponent(variantId)}`);
  },

  updateVariantImage(id, formDataOrData) {
    if (formDataOrData instanceof FormData) {
      const headers = {};
      const authToken = localStorage.getItem('authToken');
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      return fetch(`${this.baseUrl}api/settings/variant-images/${id}/`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw Object.assign(new Error(err.detail || 'Error al actualizar'), { data: err });
        }
        return res.json();
      });
    }
    return this.patch(`api/settings/variant-images/${id}/`, formDataOrData);
  },

  deleteVariantImage(id) {
    return this.delete(`api/settings/variant-images/${id}/`);
  },
};

export default api;
