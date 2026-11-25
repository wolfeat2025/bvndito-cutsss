# Bvndito Cutsss · app del barbero (semana de prueba)

App web instalable (PWA) para el barbero de Bvndito Cutsss: agenda del día, caja, cronómetro por corte,
fichas de clientes con fotos y "Mis números". El cliente avisa que llegó escaneando un QR que el barbero
le muestra en su propio celular.

- `index.html` · app del barbero. Se abre con su link privado `?b=CÓDIGO` y se agrega a la pantalla de inicio.
- `llegue.html?p=…` · página del QR para el cliente: nombre, teléfono opcional y un botón.
- Datos en Firebase (Firestore + sesión anónima), igual que el Cuaderno de Juan. Reglas en `firestore.rules`.

## Publicar (una sola vez)

1. **Crear el proyecto**: https://console.firebase.google.com → *Agregar proyecto* → nombre `bvndito-cutsss` → sin Google Analytics.
2. **Base de datos**: *Compilación → Firestore Database → Crear base de datos* → ubicación `southamerica-east1 (São Paulo)` → *modo de producción*.
3. **Reglas**: en Firestore, pestaña *Reglas* → borrar todo → pegar el contenido de `firestore.rules` → *Publicar*.
4. **Sesión anónima**: *Compilación → Authentication → Comenzar → Método de acceso → Anónimo → Habilitar → Guardar*.
5. **Datos de la app web**: ⚙️ *Configuración del proyecto → Tus apps → `</>` Web* → apodo `bvndito` (sin Hosting) → copiar el bloque `firebaseConfig` y pegarlo en `js/config.js`.
6. Subir el cambio a GitHub. La app queda en https://wolfeat2025.github.io/bvndito-cutsss/

## Instalar en el iPhone del barbero

1. Abrir en **Safari** su link privado (`https://wolfeat2025.github.io/bvndito-cutsss/?b=…`). No compartirlo con nadie más.
2. Botón Compartir → **Agregar a inicio**. Desde ahí se abre como app.
3. Para que un cliente avise que llegó: botón **QR** arriba en "Hoy" → el cliente lo escanea con su cámara.

## Probar en el PC

```
node pruebas/e2e.cjs
```

Levanta los emuladores de Firebase y recorre el flujo completo con un barbero y tres clientes en navegadores separados
(usa `firebase-tools` y Playwright instalados en `D:\CUADERNO_JUAN\pruebas`). Las capturas quedan en `pruebas/capturas/`.

## Lo que esta versión de prueba NO hace todavía

- El bot de Instagram no está conectado: las horas se agregan con el botón +, y el aviso de "No vino" se copia para pegarlo a mano.
- Las fotos se guardan comprimidas dentro de Firestore (sirve para la prueba; en producción van a Drive o Storage).
