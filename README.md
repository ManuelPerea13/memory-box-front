# Memory Box — Frontend (Next.js)

Frontend de **Memory Box** (cajas de fotos personalizadas) reescrito en **Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn**. Consume la API de [`memory-box-back`](../memory-box-back) (Django REST + WebSockets).

Es la migración del front original (`memory-box-front`, Create React App + JS) con **paridad funcional completa**, tomando como base la plantilla de `asociadosmm-front`.

## Stack

- **Next.js 16** (App Router, `output: standalone`)
- **React 19** + **TypeScript** estricto
- **Tailwind CSS v4** + **shadcn** (tokens y helpers en `src/app/globals.css`)
- **fetch** nativo (cliente en `src/lib/api.ts`)
- **JWT** en `localStorage` (`src/contexts/AuthContext.tsx`)
- **WebSockets** para pedidos y stock en tiempo real (`src/hooks`)
- Gráficos con **chart.js** / **react-chartjs-2**, recorte con **react-easy-crop**

## Estructura

```
src/
├── app/                      # Rutas (App Router)
│   ├── page.tsx              # Home (landing pública)
│   ├── cliente/page.tsx      # Datos del cliente → crea pedido
│   ├── editor/page.tsx       # Editor de recorte de imágenes
│   ├── pedido/[id]/page.tsx  # Vista pública de pedido
│   ├── login/page.tsx        # Login admin
│   └── admin/                # Panel admin (protegido)
│       ├── layout.tsx        # Guard + sidebar + notificaciones
│       ├── page.tsx          # Dashboard de pedidos
│       ├── stock/  precios/  costos/  fondo/  variantes/  estadisticas/
├── components/               # AdminLayout, ui (button, AppSelect), auth guard
├── contexts/AuthContext.tsx  # Auth JWT
├── hooks/                    # useOrdersWebSocket, useStockWebSocket
├── lib/api.ts                # Cliente HTTP (contrato con el backend)
└── types/                    # Tipos de dominio
```

## Variables de entorno

`.env.local` (ver `.env.example`):

```bash
# URL base del backend (con barra final). Vacío o "/" usa el host actual en :8000.
NEXT_PUBLIC_API_URL=http://localhost:8000/
```

> `NEXT_PUBLIC_*` se hornea en build. En el `Dockerfile` se pasa como `--build-arg`.

## Desarrollo local (sin Docker)

```bash
npm install
npm run dev          # http://localhost:3000  (requiere el backend en :8000)
```

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `check` (lint + typecheck + build).

## Docker

### Solo el front

```bash
docker compose up dev      # dev con hot-reload → http://localhost:3001
docker compose up app      # build de producción → http://localhost:3000
```

### Stack completo (backend + Postgres + front)

Levanta backend + Postgres + front de una. Es **autocontenido** y usa puertos
propios (8001 / 3002) para no chocar con otros stacks en `8000` / `3000`:

```bash
docker compose -f docker-compose.full.yml up --build
docker compose -f docker-compose.full.yml down       # detener
```

- Backend API : http://localhost:8001
- Frontend    : http://localhost:3002

El compose setea `FRONTEND_URL=http://localhost:3002` en el backend para que los
QR generados apunten al front local, y `NEXT_PUBLIC_API_URL=http://localhost:8001/`
en el front. Reutiliza el `.env` del backend para credenciales de Postgres.
