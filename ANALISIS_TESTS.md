# Análisis Profundo de Tests - npm-crudify-core

## Resumen Ejecutivo

**Estado Actual**: 42 de 100 tests fallando (42% fallo)
**Problema Principal**: Singleton Crudify con `isInitialized` flag que previene re-inicialización entre tests
**Causa Raíz**: Tests no resetean completamente el estado del singleton entre ejecuciones

## Estructura Actual

```
src/
├── crudify.ts          # Clase Singleton principal (1,036 líneas)
├── types.ts            # Definiciones de tipos
├── fetch-impl.ts       # Implementación de fetch
└── index.ts            # Exports públicos

tests/
├── unit/
│   ├── token-validation.test.ts    ✅ 12 tests passing
│   ├── response-formatting.test.ts ✅ 21 tests passing
│   ├── configuration.test.ts       ✅ 10 tests passing
│   ├── auth-operations.test.ts     ❌ 11/17 tests failing
│   └── crud-operations.test.ts     ❌ 19/23 tests failing
├── e2e/
│   ├── auth-flow.e2e.test.ts       ❌ 3/5 tests failing
│   ├── refresh-token-flow.e2e.test.ts ❌ 4/6 tests failing
│   └── complete-user-flow.e2e.test.ts ❌ 5/6 tests failing
└── README.md
```

## Funcionalidades Principales de la Librería

### 1. **Inicialización y Configuración**
- `config(env)` - Configurar entorno (dev/stg/api/prod)
- `init(publicApiKey, logLevel?)` - Inicializar SDK con API key
- Singleton pattern con guard `isInitialized`
- Promise sharing para prevenir init() concurrentes

### 2. **Autenticación**
- `login(identifier, password)` - Login con email/username
- `logout()` - Limpiar sesión
- `isLogin()` - Verificar sesión válida
- Soporte para JWT tokens con validación estructural

### 3. **Refresh Token Pattern**
- `refreshAccessToken()` - Renovar access token
- `setTokens(config)` - Configurar tokens manualmente (restore session)
- `getTokenData()` - Obtener info de tokens actuales
- Auto-refresh antes de operaciones críticas (buffer de 30s/2min/5min)
- Race condition prevention con promise reuse
- Token validation (estructura JWT, expiración, tipo)

### 4. **Operaciones CRUD**
- `createItem(moduleKey, data)` / `createItemPublic()`
- `readItem(moduleKey, filter)` / `readItems()`
- `updateItem(moduleKey, data)`
- `deleteItem(moduleKey, id)`
- `transaction(data)` - Transacciones atómicas
- `getPermissions()` / `getStructure()` / `getStructurePublic()`
- `generateSignedUrl(data)` - Para uploads S3
- `getTranslation(sections?)` - Traducciones

### 5. **Seguridad**
- Sanitización de logs (oculta tokens/keys/passwords)
- Validación de JSON payloads (DoS protection, size limits)
- Detección de propiedades peligrosas (`__proto__`, `constructor`, etc)
- Validación JWT estructural (3 partes, campos requeridos, tipo)

### 6. **Características Avanzadas**
- `setResponseInterceptor()` - Interceptar respuestas GraphQL
- `setTokenInvalidationCallback()` - Callback cuando tokens se invalidan
- `isTokenRefreshInProgress()` - Check de refresh en progreso
- `shutdown()` - Cleanup de recursos (Node.js)
- AbortSignal support para cancelar requests

## Problemas Identificados

### Problema 1: Singleton State Not Reset Between Tests

**Código en crudify.ts:176-178:**
```typescript
private isInitialized: boolean = false;
private initPromise: Promise<{...}> | null = null;
```

**Problema**: `isInitialized` nunca se resetea en `beforeEach()`

**Tests afectados**: 42 tests

**Solución**: Agregar reset de `isInitialized` y `initPromise` en `beforeEach`

### Problema 2: Init Guard Prevents Re-initialization

**Código en crudify.ts:200-205:**
```typescript
if (this.isInitialized) {
  if ((logLevel || this.logLevel) === "debug") {
    console.log("Crudify: Already initialized, skipping duplicate init() call");
  }
  return { apiEndpointAdmin: this.apiEndpointAdmin, apiKeyEndpointAdmin: this.apiKeyEndpointAdmin };
}
```

**Problema**: Tests que llaman `init()` múltiples veces son bloqueados

**Tests afectados**: auth-operations.test.ts (4 tests), e2e tests (12 tests)

**Solución**: Resetear `isInitialized = false` antes de cada test

### Problema 3: Missing Test Coverage

**Funcionalidades sin tests**:
- `fetch-impl.ts` - Sin tests unitarios
- Token invalidation callback (parcial)
- Shutdown functionality (parcial)
- Error sanitization en diferentes contextos
- Concurrent request handling
- Métodos privados críticos:
  - `clearTokensAndRefreshState()`
  - `isAccessTokenValid()`
  - `isTokenExpired()` con diferentes urgency levels
  - `containsDangerousProperties()`

### Problema 4: Test Environment Isolation Issues

**Tests e2e** comparten estado entre tests:
- `auth-flow.e2e.test.ts` - Test 2 falla por estado del Test 1
- `complete-user-flow.e2e.test.ts` - Test 2 falla por estado del Test 1
- `refresh-token-flow.e2e.test.ts` - Test 2 falla por estado del Test 1

### Problema 5: Mock Fetch Not Persisting

Algunos tests configuran `globalThis.fetch` en `beforeEach()` pero otros tests lo sobrescriben, causando conflictos.

## Análisis de Tests Fallidos

### auth-operations.test.ts (11 failing)

| Test | Razón | Prioridad |
|------|-------|-----------|
| should throw error when initialization fails | Init() ya inicializado, no lanza error | Alta |
| should reset tokens on re-initialization | Init() skipea reinit, tokens no se limpian | Alta |
| should set log level during init | Init() skipea, logLevel no cambia | Media |
| should login successfully with email | beforeEach() no inicializa correctamente | Alta |
| should login successfully with username | beforeEach() no inicializa correctamente | Alta |
| should handle login failure with field errors | beforeEach() no inicializa correctamente | Media |
| should handle invalid credentials error | beforeEach() no inicializa correctamente | Media |
| should refresh token successfully | beforeEach() no inicializa correctamente | Alta |
| should handle refresh token failure | beforeEach() no inicializa correctamente | Alta |
| should skip refresh if token is not expired | beforeEach() no inicializa correctamente | Media |
| should prevent concurrent refresh requests | beforeEach() no inicializa correctamente | Alta |

### crud-operations.test.ts (19 failing)

Todos por la misma razón: `Crudify: Not initialized. Call init() first.`

### e2e tests (12 failing)

Todos los tests e2e fallan por:
1. Test anterior deja el singleton inicializado
2. Siguiente test intenta inicializar y falla
3. Estado compartido entre tests

## Recomendaciones de Corrección

### 1. Crear Helper de Reset Completo

```typescript
// tests/helpers/testUtils.ts
export function resetCrudifyState() {
  const instance = CrudifyInstance as any;

  // Reset all state
  instance.token = "";
  instance.refreshToken = "";
  instance.tokenExpiresAt = 0;
  instance.refreshExpiresAt = 0;
  instance.endpoint = "";
  instance.apiKey = "";
  instance.publicApiKey = "";
  instance.logLevel = "none";
  instance.apiEndpointAdmin = "";
  instance.apiKeyEndpointAdmin = "";
  instance.responseInterceptor = null;
  instance.refreshPromise = null;
  instance.isRefreshing = false;
  instance.onTokensInvalidated = null;

  // ✅ CRÍTICO: Reset initialization guards
  instance.isInitialized = false;
  instance.initPromise = null;
}
```

### 2. Usar en Todos los beforeEach

```typescript
beforeEach(() => {
  resetCrudifyState();
  originalFetch = globalThis.fetch;
});
```

### 3. Agregar Tests Faltantes

#### A. Tests para fetch-impl.ts
- Test de fetch con diferentes entornos (browser vs Node.js)
- Test de shutdown en Node.js
- Test de error handling

#### B. Tests para validación de tokens
- `isAccessTokenValid()` con diferentes casos:
  - Token malformado (< 3 partes)
  - Token sin campos requeridos (sub, exp)
  - Token con tipo incorrecto (refresh en vez de access)
  - Token expirado
  - Token válido

#### C. Tests para sanitización
- `sanitizeForLogging()` con diferentes tipos de datos sensibles
- `containsDangerousProperties()` con payloads maliciosos

#### D. Tests para buffers de expiración
- `isTokenExpired("critical")` - 30s buffer
- `isTokenExpired("high")` - 2min buffer
- `isTokenExpired("normal")` - 5min buffer

### 4. Reestructurar Tests E2E

Separar en grupos independientes con cleanup completo:

```typescript
describe("E2E: Auth Flow", () => {
  let savedFetch: typeof globalThis.fetch;

  beforeEach(() => {
    resetCrudifyState();
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    resetCrudifyState();
    globalThis.fetch = savedFetch;
  });

  // tests...
});
```

### 5. Agregar Test de Concurrencia

```typescript
it("should handle concurrent operations during token refresh", async () => {
  // Simular múltiples requests concurrentes durante un refresh
  // Verificar que todos usen el mismo refreshPromise
  // Verificar que no hay race conditions
});
```

## Plan de Acción

### Fase 1: Corrección Inmediata (Alta Prioridad)
1. ✅ Crear `resetCrudifyState()` helper
2. ✅ Aplicar reset en todos los `beforeEach()`
3. ✅ Correr tests y verificar que 42 tests ahora pasen

### Fase 2: Cobertura Completa (Media Prioridad)
4. ⏳ Agregar tests para `fetch-impl.ts`
5. ⏳ Agregar tests para métodos privados críticos
6. ⏳ Agregar tests para buffers de expiración
7. ⏳ Agregar tests para sanitización completa

### Fase 3: Tests Avanzados (Baja Prioridad)
8. ⏳ Tests de concurrencia y race conditions
9. ⏳ Tests de performance (tiempo de refresh, timeout)
10. ⏳ Tests de memoria (leaks en long-running scenarios)

### Fase 4: Documentación
11. ⏳ Actualizar README.md con mejores ejemplos
12. ⏳ Actualizar CHANGELOG.md con mejoras de testing
13. ⏳ Crear TESTING.md similar a npm-crudify-ui

## Métricas de Éxito

- ✅ **100% tests passing** (100/100)
- ✅ **≥ 85% code coverage** (statements, branches, functions)
- ✅ **< 5s test execution time** para suite completa
- ✅ **Zero flaky tests** (determinísticos, sin random failures)
- ✅ **CI/CD integration** ready (GitHub Actions)

## Comparación con npm-crudify-ui

| Aspecto | npm-crudify-ui | npm-crudify-core | Recomendación |
|---------|----------------|------------------|---------------|
| Tests passing | 150/150 (100%) | 58/100 (58%) | Alcanzar 100% |
| Test structure | Excelente | Buena pero incompleta | Mejorar coverage |
| Test helpers | Bien organizados | Faltantes | Crear helpers |
| CI/CD | ✅ Configurado | ❌ Faltante | Agregar workflow |
| Documentation | ✅ TESTING.md | ❌ Faltante | Crear docs |
| Coverage goals | ≥80% definido | No definido | Definir metas |

---

**Fecha**: 2025-10-14
**Autor**: Análisis técnico de npm-crudify-core
**Próximos pasos**: Implementar Fase 1 - Corrección Inmediata
