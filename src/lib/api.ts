// Cliente HTTP para memory-box-back.
// En prod se inyecta NEXT_PUBLIC_API_URL en build; en dev, si no está seteada,
// se usa el host actual del navegador apuntando al puerto 8000 del backend.

const ENV_URL = process.env.NEXT_PUBLIC_API_URL;

const getBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/`;
  }
  return "http://localhost:8000/";
};

// Si NEXT_PUBLIC_API_URL es "/" o vacío → mismo origen (las rutas ya llevan "api/").
const BASE_URL: string =
  ENV_URL === "/" || ENV_URL === ""
    ? "/"
    : ENV_URL
      ? ENV_URL.replace(/\/$/, "") + "/"
      : getBaseUrl();

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

const getHeaders = (authenticated = true): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authenticated && typeof window !== "undefined") {
    const authToken = localStorage.getItem("authToken");
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
};

const authHeaderOnly = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const authToken = localStorage.getItem("authToken");
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
};

async function request<T = unknown>(
  url: string,
  method: Method = "GET",
  data: unknown = null,
  authenticated = true,
): Promise<T> {
  const config: RequestInit = {
    method,
    headers: getHeaders(authenticated),
    credentials: "include",
  };
  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    config.body = JSON.stringify(data);
  }
  const response = await fetch(`${BASE_URL}${url}`, config);
  if (!response.ok) {
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const error: ApiError = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  if (response.status === 204) return null as T;
  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return {} as T;
}

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

export interface SubmitTask {
  task_id: string;
  status: string;
  total: number;
}

export interface SubmitStatus {
  state: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE" | string;
  done: number;
  total: number;
  error?: string;
}

const api = {
  baseUrl: BASE_URL,

  get<T = unknown>(url: string, authenticated = true) {
    return request<T>(url, "GET", null, authenticated);
  },
  post<T = unknown>(url: string, data?: unknown, authenticated = true) {
    return request<T>(url, "POST", data ?? null, authenticated);
  },
  put<T = unknown>(url: string, data?: unknown, authenticated = true) {
    return request<T>(url, "PUT", data ?? null, authenticated);
  },
  patch<T = unknown>(url: string, data?: unknown) {
    return request<T>(url, "PATCH", data ?? null);
  },
  delete<T = unknown>(url: string) {
    return request<T>(url, "DELETE");
  },

  authenticate(email: string, password: string) {
    return this.post<{ access: string }>("api/api-token-auth/", { email, password }, false);
  },

  // ─── Orders ───
  getOrders(includeHidden = false) {
    const qs = includeHidden ? "?include_hidden=1" : "";
    return this.get(`api/orders/${qs}`);
  },
  getOrder(id: string | number) {
    return this.get(`api/orders/${id}/`, false);
  },
  createOrder(data: unknown) {
    return this.post("api/orders/", data, false);
  },
  updateOrder(id: string | number, data: unknown) {
    return this.put(`api/orders/${id}/`, data, false);
  },
  patchOrder(id: string | number, data: unknown) {
    return this.patch(`api/orders/${id}/`, data);
  },
  sendOrder(id: string | number) {
    return this.post(`api/orders/${id}/send_order/`, {}, false);
  },
  /** Regenera solo el PNG del QR con FRONTEND_URL del servidor (admin). */
  regenerateOrderQr(id: string | number) {
    return this.post(`api/orders/${id}/regenerate_qr/`, {});
  },

  /** Descarga las imágenes del pedido como ZIP (lo arma el backend). Requiere auth. */
  getOrderZip(orderId: string | number, defaultFilename: string | null = null): Promise<DownloadResult> {
    const url = `${BASE_URL}api/orders/${orderId}/download_zip/`;
    return fetch(url, {
      method: "GET",
      headers: getHeaders(true),
      credentials: "include",
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || res.headers.get("content-disposition");
      let filename: string | null = null;
      if (disp) {
        const matchStar = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disp);
        if (matchStar?.[1]) {
          try {
            filename = decodeURIComponent(matchStar[1].trim());
          } catch {
            filename = matchStar[1].trim();
          }
        }
        if (!filename) {
          const match = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(disp);
          filename = (match?.[1] || match?.[2] || "").trim() || null;
        }
      }
      if (!filename) filename = defaultFilename || `order-${orderId}.zip`;
      return { blob, filename };
    });
  },

  /**
   * Encola el procesamiento async de las 10 imágenes. Devuelve { task_id, status, total }.
   * Usa XHR (no fetch) para poder reportar el progreso REAL de subida vía onUploadProgress(0-100).
   */
  submitOrderImages(
    orderId: string | number,
    formData: FormData,
    onUploadProgress?: (pct: number) => void,
  ): Promise<SubmitTask> {
    return new Promise<SubmitTask>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}api/orders/${orderId}/submit_images/`);
      xhr.withCredentials = true;
      if (onUploadProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as SubmitTask);
          } catch {
            resolve({} as SubmitTask);
          }
        } else {
          let msg = `Request failed: ${xhr.status}`;
          try {
            const e = JSON.parse(xhr.responseText) as { error?: string };
            if (e.error) msg = e.error;
          } catch {
            /* respuesta no-JSON */
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Error de red al subir las imágenes"));
      xhr.send(formData);
    });
  },

  /** Estado del procesamiento async de imágenes (poll). */
  getSubmitStatus(orderId: string | number, taskId: string) {
    return this.get<SubmitStatus>(
      `api/orders/${orderId}/submit_status/?task_id=${encodeURIComponent(taskId)}`,
      false,
    );
  },

  // ─── Image crops ───
  getImageCrops(orderId: string | number) {
    return this.get(`api/image-crops/?order_id=${orderId}`, false);
  },
  createImageCrop(data: unknown) {
    return this.post("api/image-crops/", data);
  },
  updateImageCrop(id: string | number, data: unknown) {
    return this.put(`api/image-crops/${id}/`, data);
  },
  /** Reemplaza la imagen de un crop existente (admin). Multipart. */
  replaceImageCrop(cropId: string | number, orderId: string | number, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    const url = `${BASE_URL}api/image-crops/${cropId}/?order_id=${encodeURIComponent(String(orderId))}`;
    return fetch(url, {
      method: "PATCH",
      headers: authHeaderOnly(),
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = err as { detail?: string; image?: string };
        throw new Error(e.detail || e.image || `Error ${res.status}`);
      }
      return res.json();
    });
  },
  deleteImageCrop(id: string | number) {
    return this.delete(`api/image-crops/${id}/`);
  },

  // ─── Stock ───
  getStock() {
    return this.get("api/stock/");
  },
  addStock(variant: string, boxType: string, amount: number) {
    return this.post("api/stock/add_stock/", { variant, box_type: boxType, amount });
  },
  setStock(variant: string, boxType: string, quantity: number) {
    return this.post("api/stock/set_stock/", { variant, box_type: boxType, quantity });
  },

  // ─── Precios y datos de transferencia ───
  getPrices(authenticated = false) {
    return this.get("api/settings/prices/", authenticated);
  },
  updatePrices(data: unknown) {
    return this.patch("api/settings/prices/", data);
  },

  // ─── Costos de referencia ───
  getCosts() {
    return this.get("api/settings/costs/");
  },
  updateCosts(data: unknown) {
    return this.patch("api/settings/costs/", data);
  },

  // ─── Packaging ───
  getPackaging() {
    return this.get("api/packaging/");
  },

  // ─── Compras / gastos ───
  getPurchases() {
    return this.get("api/purchases/");
  },
  createPurchase(data: unknown) {
    return this.post("api/purchases/", data);
  },
  updatePurchase(id: string | number, data: unknown) {
    return this.patch(`api/purchases/${id}/`, data);
  },
  deletePurchase(id: string | number) {
    return this.delete(`api/purchases/${id}/`);
  },

  // ─── Estadísticas ───
  getEstadisticas(days = 30, months = 12) {
    const qs = `?days=${encodeURIComponent(days)}&months=${encodeURIComponent(months)}`;
    return this.get(`api/estadisticas/${qs}`);
  },

  // ─── Video/música de fondo del home ───
  getHomeBackground(authenticated = false) {
    return this.get("api/settings/home-background/", authenticated);
  },
  updateHomeBackground(data: unknown) {
    return this.patch("api/settings/home-background/", data);
  },
  getBackgroundMedia(type: string | null = null) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.get(`api/settings/background-media/${qs}`);
  },
  createBackgroundMedia(formDataOrData: FormData | unknown) {
    if (formDataOrData instanceof FormData) {
      return fetch(`${this.baseUrl}api/settings/background-media/`, {
        method: "POST",
        headers: authHeaderOnly(),
        credentials: "include",
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = err as { detail?: string; file?: string };
          throw Object.assign(new Error(e.detail || e.file || "Error al crear"), { data: err });
        }
        return res.json();
      });
    }
    return this.post("api/settings/background-media/", formDataOrData);
  },
  updateBackgroundMedia(id: string | number, formDataOrData: FormData | unknown) {
    if (formDataOrData instanceof FormData) {
      return fetch(`${this.baseUrl}api/settings/background-media/${id}/`, {
        method: "PATCH",
        headers: authHeaderOnly(),
        credentials: "include",
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = err as { detail?: string; name?: string };
          throw Object.assign(new Error(e.detail || e.name || "Error al actualizar"), { data: err });
        }
        return res.json();
      });
    }
    return this.patch(`api/settings/background-media/${id}/`, formDataOrData);
  },

  // ─── Variantes de caja ───
  getVariantsPublic() {
    return this.get("api/settings/variants/public/", false);
  },
  getVariants() {
    return this.get("api/settings/variants/");
  },
  createVariant(data: unknown) {
    return this.post("api/settings/variants/", data);
  },
  updateVariant(id: string | number, data: unknown) {
    return this.patch(`api/settings/variants/${id}/`, data);
  },
  createVariantImage(formDataOrData: FormData | unknown) {
    if (formDataOrData instanceof FormData) {
      return fetch(`${this.baseUrl}api/settings/variant-images/`, {
        method: "POST",
        headers: authHeaderOnly(),
        credentials: "include",
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = err as { detail?: string; file?: string };
          throw Object.assign(new Error(e.detail || e.file || "Error al crear"), { data: err });
        }
        return res.json();
      });
    }
    return this.post("api/settings/variant-images/", formDataOrData);
  },
  getVariantImages(variantId: string | number) {
    return this.get(`api/settings/variant-images/?variant_id=${encodeURIComponent(String(variantId))}`);
  },
  updateVariantImage(id: string | number, formDataOrData: FormData | unknown) {
    if (formDataOrData instanceof FormData) {
      return fetch(`${this.baseUrl}api/settings/variant-images/${id}/`, {
        method: "PATCH",
        headers: authHeaderOnly(),
        credentials: "include",
        body: formDataOrData,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = err as { detail?: string };
          throw Object.assign(new Error(e.detail || "Error al actualizar"), { data: err });
        }
        return res.json();
      });
    }
    return this.patch(`api/settings/variant-images/${id}/`, formDataOrData);
  },
  deleteVariantImage(id: string | number) {
    return this.delete(`api/settings/variant-images/${id}/`);
  },
};

export default api;
