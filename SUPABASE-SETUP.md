# Configurar Supabase

Supabase ofrece una capa gratuita con límites de uso que pueden cambiar. Consulta sus condiciones actuales antes de publicar el proyecto. No necesitas guardar contraseñas en una tabla propia: Supabase Auth gestiona las cuentas de forma segura.

## Crear y conectar el proyecto

1. Crea una cuenta en [supabase.com](https://supabase.com/) y un proyecto nuevo en el plan gratuito. Guarda la contraseña de la base de datos en un gestor de contraseñas; no la pongas en los archivos del sitio.
2. En el proyecto, abre **SQL Editor**, crea una consulta nueva, pega todo el contenido de `supabase-setup.sql` y pulsa **Run**. Esto crea el catálogo, la tabla privada de carritos, las políticas RLS y la función para sumar productos.
3. En **Project Settings → API**, copia la **Project URL** y la clave pública **anon** (o **publishable**).
4. Pega esos dos valores en `supabase-config.js`:

   ```js
   window.VIDEOGAMER_SUPABASE_CONFIG = {
     url: "https://TU-PROYECTO.supabase.co",
     anonKey: "TU-CLAVE-PUBLICA"
   };
   ```

5. Ejecuta el sitio desde un servidor local, por ejemplo **Live Server** en VS Code; no uses `file://` para probar autenticación. En Supabase, abre **Authentication → URL Configuration** y configura la URL local que te indique Live Server como **Site URL** y como URL permitida de redirección. Cuando publiques el sitio, agrega también su URL pública.
6. Abre el sitio, crea una cuenta con correo y contraseña y confirma el correo si Supabase lo solicita. Inicia sesión para agregar productos. El carrito queda asociado a la cuenta y se conserva entre páginas y sesiones.

## Datos y seguridad

- El catálogo activo se puede consultar públicamente; solo una persona con acceso al panel de Supabase debe modificar precios y productos.
- Los usuarios solo pueden leer y cambiar las filas de carrito que pertenecen a su propia cuenta. Esto se aplica también desde la API mediante Row Level Security (RLS).
- La clave pública del cliente está diseñada para usarse en el navegador con RLS habilitado. **Nunca pongas `service_role`, la contraseña de la base de datos ni otros secretos en `supabase-config.js`.**
- Las compras se consultan y el total se muestra como referencia; el botón continúa por WhatsApp. Este proyecto todavía no procesa pagos ni registra pedidos.
