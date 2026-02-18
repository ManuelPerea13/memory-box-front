# memory-box-front (Cajita de la Memoria – React)

Frontend React para el sistema de pedidos Cajita de la Memoria. Orden de carpetas replicado de catriel-front.

## Estructura

```
memory-box-front/
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

## Rutas

- `/` – Inicio
- `/cliente` – Formulario datos del cliente (crea pedido y redirige al editor)
- `/editor/:pedidoId` – Editor de imágenes (placeholder; integrar Cropper/react-image-crop)
- `/login` – Login admin
- `/admin` – Panel admin (protegido, lista de pedidos)
