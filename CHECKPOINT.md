# Checkpoint — front (memory-box)

> Actualizado: 2026-08-06

## Estado general

🟢 Prod en https://memory-box.shop (Cloudflare + tunnel mark1,
mismo origen con el back). Integrado al dev-panel (app :3104,
dev :3154). Estado real del código sin relevar todavía.

## Último trabajo (2026-08-06)

Migración completa a memory-box.shop (commit `ed1a5f9`):

- DNS en Cloudflare: apex y `www` CNAME al tunnel `mark1`, proxied.
  Zona activa; NS cambiados en Hostinger.
- Ingress (`k8s/microk8s/base/ingress.yaml`): solo hosts
  memory-box.shop + www; `/api`, `/media` y `/docs` van al back,
  el resto (incl. `/admin` y `/static`, que son del front) al front.
- Build con `NEXT_PUBLIC_API_URL="/"` (mismo origen) en el workflow.
- innovbi.site eliminado de los ingress de memory-box (da 404).
- Droplet viejo (146.190.33.106) ya no sirve el dominio.
- Deploy manual desde mark1 (GitHub Actions no disparó el push
  event ese día); verificado: front 200, /api 200, bundle sin
  referencias a api.innovbi.site.

## Hecho

- Integrado al dev-panel (app :3104, dev :3154).
- Dominio memory-box.shop end-to-end (DNS CF + tunnel + ingress +
  build mismo-origen), 2026-08-06.
- Ruta /ws al back en el ingress (websockets orders/stock,
  handshake 101 verificado) y cert de origen emitido, 2026-08-06.

## Pendiente

- [ ] Completar este checkpoint con el estado real del proyecto
      (leer el código en la próxima tarea).
- [ ] Revisar por qué el push a master no disparó GitHub Actions
      (runner mark1 estaba vivo y polleando; ¿incidente de GitHub?).

## Pantallas y rutas

<completar en próxima tarea>

## Integración con API

- Prod: mismo origen (`NEXT_PUBLIC_API_URL="/"`); `src/lib/api.ts`
  antepone `api/` a cada ruta.
- Back en dev: http://localhost:8104

## Notas / riesgos

- Django admin del back quedó solo por LAN
  (http://192.168.88.50:30082/admin): `/admin` público es del front.
