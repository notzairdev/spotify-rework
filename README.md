# Spotify Rework

Una versión reimaginada del cliente de escritorio de Spotify, construida con **Tauri 2**, **Next.js 16** y **TypeScript**. Ofrece una interfaz moderna y funciones nativas, aprovechando la **Spotify Web API** y la **Web Playback SDK**.

![Estado: Beta](https://img.shields.io/badge/status-beta-yellow) ![Tauri](https://img.shields.io/badge/Tauri-2.x-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black)

Resumen rápido
- Interfaz propia y moderna inspirada en Spotify.
- Autenticación segura con PKCE y servidor local de callback.
- Cifrado de sesiones con clave derivada del hardware (AES-256-GCM).
- Reproducción mediante Web Playback SDK (requiere cuenta Premium).
- Integración nativa con ventanas y controles de Tauri.

Índice
- Características
- Requisitos
- Instalación rápida
- Configuración de Spotify
- Variables de entorno
- Desarrollo
- Estructura del proyecto
- Comandos Tauri disponibles
- Notas importantes
- Contribuir
- Licencia y descargo

Características
- UI personalizada y componentes reutilizables.
- Flujo de OAuth (PKCE) con servidor local para captura del código.
- Persistencia de sesión y refresco automático de tokens.
- Cifrado de sesiones para impedir copia entre máquinas.
- Soporte para reproducción y control desde la aplicación.

Requisitos
- Node.js 18+
- Rust 1.70+
- Tauri CLI (ver requisitos en la documentación oficial)
- Cuenta de desarrollador de Spotify

Instalación rápida
```bash
git clone https://github.com/notzairdev/spotify-rework.git
cd spotify-rework
npm install
```

Configuración de la app en Spotify
1. Abre el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) y crea una app.
2. Añade la Redirect URI: `http://127.0.0.1:8888/callback`.
3. Guarda el `Client ID` y el `Client Secret`.

Variables de entorno
Crear un archivo `.env.local` en la raíz con:
```env
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=tu_client_id_aqui
SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui
```

Desarrollo
Inicia la aplicación en modo desarrollo (frontend + Tauri):
```bash
npm run tauri dev
```

Compilación para producción
```bash
npm run tauri build
```
Los binarios resultantes se encontrarán en `src-tauri/target/release/`.

Estructura principal (resumen)
```
app/           # Rutas y páginas de Next.js (App Router)
components/    # Componentes React (ui, auth, player, tauri)
hooks/         # Hooks personalizados
lib/           # Lógica de negocio (auth, spotify, tauri utils)
public/        # Assets estáticos
src-tauri/     # Código Rust y configuración de Tauri
```

Comandos Tauri disponibles
- `get_auth_url` — Genera la URL de autorización de Spotify.
- `exchange_code` — Intercambia el código por tokens.
- `get_session` — Obtiene la sesión actual.
- `refresh_session` — Refresca el token de acceso.
- `logout` — Elimina la sesión almacenada.
- `get_access_token` — Obtiene el token de acceso vigente.

Notas importantes
- Web Playback SDK requiere cuenta Spotify Premium para controlar reproducción.
- En modo desarrollo de Spotify, solo usuarios registrados en la app pueden iniciar sesión.
- El cifrado de sesión se basa en datos de hardware; esto evita copiar sesiones entre equipos.

Actualizaciones y releases
- La aplicación comprueba al iniciar el `latest.json` del último release publicado en [`notzairdev/spotify-rework-dist`](https://github.com/notzairdev/spotify-rework-dist). También se puede comprobar manualmente desde Configuración.
- Los instaladores de actualización están firmados. La clave privada nunca debe añadirse al repositorio ni regenerarse después de publicar la primera versión.
- El workflow `.github/workflows/release.yml` compila Windows, Linux x64/ARM64 y macOS Intel/Apple Silicon, genera `latest.json` y deja el release como borrador en el repositorio público de distribución; el código fuente puede permanecer privado.
- GitHub requiere los secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` y un `DIST_REPO_TOKEN` con acceso de escritura únicamente a `spotify-rework-dist`, además de la variable pública `SPOTIFY_CLIENT_ID`.
- Antes de crear un release, actualiza la misma versión SemVer en `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`; `npm run version:check` valida que coincidan.
- Para preparar un release usa un tag `vX.Y.Z` o ejecuta el workflow manualmente. Revisa los artefactos del borrador y publícalo desde GitHub cuando esté listo; los borradores no llegan al updater.

Contribuir
1. Haz fork del repositorio.
2. Crea una rama de trabajo: `feature/mi-cambio`.
3. Haz tus cambios y abre un Pull Request.

Licencia
MIT — ver el archivo [LICENSE](LICENSE).

Descargo de responsabilidad
Este proyecto es no oficial y no está afiliado ni respaldado por Spotify AB. Úsalo bajo tu propia responsabilidad.
