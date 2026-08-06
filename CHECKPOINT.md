# Checkpoint — front (memory-box)

> Actualizado: 2026-08-03

## Estado general

🟡 En desarrollo. Integrado al dev-panel (app :3104, dev :3154). Estado
real del código sin relevar todavía.

## Último trabajo (2026-08-06)

Migración de dominio memory-box.shop al ingress de mark1:
`k8s/microk8s/base/ingress.yaml` suma hosts `memory-box.shop` y
`www.memory-box.shop` (TLS en secret aparte
`memory-box-front-shop-tls`). Aplicado en mark1; el ingress ya
responde el front para ese Host. Tunnel cloudflared ya tenía las
entradas. El droplet viejo (146.190.33.106) dejó de servir el
dominio (backup `nginx.conf.bak-20260806`). Cambio aplicado directo
al cluster, **sin commit todavía**.

## Hecho

- Integrado al dev-panel (app :3104, dev :3154).
- Ingress con memory-box.shop + www (2026-08-06).
- Zona memory-box.shop en CF: apex CNAME al tunnel mark1 + www,
  proxied (2026-08-06). CNAMEs erróneos en innovbi.com borrados.

## Pendiente

- [ ] Completar este checkpoint con el estado real del proyecto
      (leer el código en la próxima tarea).
- [ ] Verificar activación de zona memory-box.shop en Cloudflare
      (NS cambiados en Hostinger 2026-08-06, propagación hasta 24h)
      y probar https://memory-box.shop + emisión de cert
      `memory-box-front-shop-tls`.
- [ ] Commit + push de ingress.yaml; pull en clones de mark1.
- [ ] Decidir si FRONTEND_URL del back pasa de innovbi.site a
      memory-box.shop (afecta QR de pedidos).

## Pantallas y rutas

<completar en próxima tarea>

## Integración con API

- Back en dev: http://localhost:8104

## Notas / riesgos

<completar en próxima tarea>
