# memory-box-front (Cajita de la Memoria – React)

Frontend React para el sistema de pedidos Cajita de la Memoria. Orden de carpetas replicado de catriel-front.

## Estructura

```
memory-box-front/
├── k8s/microk8s/        # deploy en mark1 (base + overlays dev/prod)
├── public/
│   └── index.html
├── src/
│   ├── App.js
│   ├── index.js
│   ├── components/
│   │   └── auth/
│   │       └── ProtectedRoute.js
│   ├── contexts/
│   │   └── AuthContext.js
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── ClientData.jsx
│   │   ├── ImageEditor.jsx
│   │   └── admin/
│   │       ├── Login.jsx
│   │       └── Dashboard.jsx
│   ├── restclient/
│   │   └── api.js
│   └── routing/
│       └── MainRouting.js
└── package.json
```

## Uso

### Con Docker Compose

```bash
cp .env.example .env
# Opcional: editar REACT_APP_API_URL (por defecto http://localhost:8000/)
docker compose up -d
```

- App: `http://localhost:3000`

### Local

```bash
npm install
npm start
```

Configuración: crear `.env` con `REACT_APP_API_URL=http://localhost:8000/` si el backend está en otra URL.

### Deploy en mark1 (MicroK8s)

Todo lo necesario está en este repo: código + `k8s/microk8s/` (base + overlays dev/prod). En mark1:

1. Clonar con deploy key en `~/workspaces/memory-box/repos/memory-box-front`.
2. Build con la URL del API (IP de mark1 + NodePort del back, ej. 30082):
   ```bash
   docker build --build-arg REACT_APP_API_URL=http://192.168.88.50:30082/ -t localhost:32000/memory-box-front:prod .
   docker push localhost:32000/memory-box-front:prod
   microk8s kubectl apply -k k8s/microk8s/overlays/prod -n memory-box-prod
   ```
3. Actualizar: `git pull`, rebuild con el mismo `--build-arg`, push, `kubectl rollout restart deployment memory-box-front -n memory-box-prod`.

Front en prod: NodePort **30083** (mismo namespace que el back: `memory-box-prod`).

### SSL con dominio (memory-box.shop)

En mark1 está configurado **Ingress** con **cert-manager** y Let's Encrypt (igual que landing-page):

- **Dominios:** `memory-box.shop`, `www.memory-box.shop`
- **TLS:** cert-manager crea el certificado usando el ClusterIssuer `letsencrypt-prod` (debe existir en el cluster, p. ej. desde innovbi/landing-page).
- **Rutas:** `/` → front, `/api` → back.

El Ingress está en `k8s/microk8s/base/ingress.yaml`. Se aplica con el mismo `kubectl apply -k ... -n memory-box-prod`.

Para que el front llame al API por el mismo dominio, recompilar con **misma-origen**:
```bash
docker build --build-arg REACT_APP_API_URL=/api/ -t localhost:32000/memory-box-front:prod .
```
Así las peticiones van a `https://memory-box.shop/api/`. En el back, asegurar `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` con `https://memory-box.shop` y `https://www.memory-box.shop`.

## Rutas

- `/` – Inicio
- `/cliente` – Formulario datos del cliente (crea pedido y redirige al editor)
- `/editor/:pedidoId` – Editor de imágenes (placeholder; integrar Cropper/react-image-crop)
- `/login` – Login admin
- `/admin` – Panel admin (protegido, lista de pedidos)
