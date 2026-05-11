# Star Backend API

API REST para la plataforma multi-canal de Star. Construida con **Hono** + **TypeScript** + **MongoDB** (Mongoose).

## Requisitos

- Node.js 18+
- MongoDB (local o Atlas)

## Instalacion

```bash
npm install
```

Crear archivo `.env` en la raiz:

```env
MONGODB_URI=mongodb://localhost:27017/starprofesional
JWT_SECRET=tu_secreto_jwt
SOURCE_BASE=http://190.60.237.164/articulos
PORT=4000
```

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor en modo desarrollo con hot-reload (tsx watch) |
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm start` | Ejecutar build compilado |

El servidor corre en `http://localhost:4000` por defecto.

## Arquitectura

```
src/
├── config/          # Conexion a MongoDB
├── db/
│   ├── migrations/  # Scripts de migracion one-time
│   └── seed/        # Datos iniciales (canales)
├── middleware/       # Autenticacion JWT
├── models/          # Esquemas Mongoose
├── routes/          # Endpoints de la API
└── utils/           # Busqueda, helpers
```

## Modelos

| Modelo | Descripcion |
|--------|-------------|
| **Product** | Productos sincronizados desde Sysplus. ~50 campos incluyendo precios escalonados, existencias por bodega, flags (promo, nuevo, destacado) |
| **Channel** | Canales de venta (StarProfesional, StarBoutique). Define bodegas y marcas asociadas |
| **Fabricante** | Directorio de fabricantes/marcas |
| **Synonym** | Sinonimos para expansion de busqueda |
| **Categoria** | Categorias de catalogo |
| **Catalogo** | Catalogos de productos |
| **Quote** | Cotizaciones de importacion (CBM) |
| **Coupon** | Cupones de descuento |
| **CotizacionLog** | Log de cotizaciones y movimientos de stock |
| **SuperAdmin** | Usuarios administradores |

## Endpoints principales

### Productos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/products` | No | Buscar/listar productos con filtros |
| GET | `/products/:codigo` | No | Producto por codigo |
| GET | `/products/:codigo/suggest` | No | Recomendaciones |
| GET | `/products/catalogo/:codFami` | No | Vista catalogo por familia |
| POST | `/products/upsert` | SuperAdmin | Upsert masivo |
| PATCH | `/products/:codigo/ref-catalogo` | SuperAdmin | Toggle referencia catalogo |
| PATCH | `/products/:codigo/promo-catalogo` | SuperAdmin | Actualizar promo catalogo |

#### Query params de `/products`

| Param | Descripcion | Ejemplo |
|-------|-------------|---------|
| `q` / `buscar` | Busqueda libre (texto, codigo, barras) | `q=cepillo` |
| `page`, `size` | Paginacion (size max 2000) | `page=1&size=50` |
| `channelId` | Filtra por canal (bodegas + marcas del canal) | `channelId=69d1b83b...` |
| `bodegas` | Bodegas manual (CSV) | `bodegas=01,06` |
| `stands` | Stands fisicos (CSV) | `stands=3H,2B` |
| `stock` | `public` (con stock), `agotado`, `all` | `stock=public` |
| `codFami` | Familia | `codFami=A` |
| `codGrupo` | Grupo | `codGrupo=1` |
| `codSubgrupo` | Subgrupo | `codSubgrupo=18` |
| `marcaId` | Nombre de marca | `marcaId=STAR` |
| `fabricanteId` | Codigo fabricante | `fabricanteId=1` |
| `desta`, `masve`, `nuevo`, `promo` | Flags booleanos | `promo=true` |
| `order` | `alpha` o `total` (por stock) | `order=alpha` |
| `dir` | `asc` o `desc` | `dir=desc` |

### Canales

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/channels` | Listar todos los canales |
| GET | `/channels/:id` | Canal por ID |
| POST | `/channels` | Crear canal (name, slug, bodegas, marcas) |
| PATCH | `/channels/:id` | Actualizar canal |
| DELETE | `/channels/:id` | Eliminar canal |

Cada canal define:
- **bodegas**: bodegas de las cuales se calcula el stock
- **marcas**: codigos de fabricante (`Fabricante`) que el canal muestra. Si esta vacio, no muestra productos (proteccion contra exponer catalogo completo)

### Sincronizacion con Sysplus

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/sync/full` | Sync completo de productos |
| GET | `/sync/full/stream` | Sync completo con progreso (SSE) |
| POST | `/sync/prices` | Sync solo precios |
| GET | `/sync/prices/stream` | Sync precios con progreso (SSE) |
| POST | `/sync/stock` | Sync solo existencias |
| GET | `/sync/stock/stream` | Sync existencias con progreso (SSE) |

Cron automatico: sincronizacion completa diaria a las 6:00 AM (Bogota).

### Otros endpoints

| Ruta | Descripcion |
|------|-------------|
| `/fabricantes` | CRUD de fabricantes (SuperAdmin) |
| `/synonyms` | CRUD de sinonimos de busqueda (SuperAdmin) |
| `/superadmins` | Gestion de usuarios admin |
| `/auth` | Autenticacion JWT |
| `/coupons` | CRUD de cupones + validacion |
| `/quotes` | Cotizaciones de importacion |
| `/catalogos` | CRUD de catalogos |
| `/categorias` | CRUD de categorias |
| `/sysplus/cotizacion/log` | Registrar cotizacion y descontar stock |
| `/health` | Health check |

## Autenticacion

Endpoints protegidos requieren header:
```
Authorization: Bearer <token_jwt>
```

El token debe tener `isSuperAdmin: true` para endpoints de administracion.

## CORS

Origenes permitidos:
- `https://starprofessional.com.co`
- `https://www.starprofessional.com.co`
- `https://beta.starprofessional.com.co`
- `https://pruebas.starprofessional.com.co`
- `http://localhost:5173`

## Despliegue

Compatible con **Vercel** (serverless) y ejecucion local con Node.js.
