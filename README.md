# Certificación Presupuestaria — UCB San Pablo

Sistema de gestión de certificaciones presupuestarias para la Universidad Católica Boliviana "San Pablo", sede Cochabamba. Aplicación de escritorio construida con **Angular 21** + **Tauri 2**.

## Requisitos previos

- [Node.js](https://nodejs.org/) v22+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Base de datos MySQL

## Desarrollo local

```bash
npm install
npx tauri dev
```

---

## Deploy y actualizaciones automáticas

La aplicación utiliza **GitHub Releases** como fuente de actualizaciones. Cada vez que se publica un nuevo tag `v*`, el workflow de GitHub Actions construye el instalador `.msi` y lo publica como release, junto con un archivo `latest.json` que el sistema de auto-actualización consume.

### 1. Configurar GitHub Secrets

En el repositorio de GitHub, ve a **Settings → Secrets and variables → Actions** y crea los siguientes secretos:

| Secreto | Descripción |
|---------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido del archivo `~/.tauri/certificacion-presupuestaria.key` (clave privada de firma) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña de la clave privada (la que se usó al generar las claves) |
| `DATABASE_URL` | Cadena de conexión MySQL, ej: `mysql://user:pass@host:3306/dbname` |

> **Nota:** Las claves de firma se generan una sola vez con:
> ```bash
> npx @tauri-apps/cli signer generate -p "TU_PASSWORD" -w ~/.tauri/certificacion-presupuestaria.key --ci
> ```
> Esto crea dos archivos: `.key` (privada) y `.key.pub` (pública). La pública ya está configurada en `tauri.conf.json`. **No pierdas la clave privada ni la contraseña**, sin ellas no se podrán firmar futuras actualizaciones.

### 2. Publicar una nueva versión

1. **Actualizar la versión** en los siguientes archivos (deben coincidir):
   - `package.json` → campo `"version"`
   - `src-tauri/tauri.conf.json` → campo `"version"`
   - `src-tauri/Cargo.toml` → campo `version` en `[package]`

2. **Commit y tag:**
   ```bash
   git add -A
   git commit -m "release: vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

3. El workflow **Release** se ejecutará automáticamente y creará un GitHub Release con:
   - El instalador `.msi` para Windows
   - El archivo `latest.json` para el auto-updater
   - La firma `.msi.zip.sig` del instalador

### 3. Cómo funciona la auto-actualización

- Al iniciar la aplicación (después del login), el sistema verifica automáticamente si hay una nueva versión disponible en GitHub Releases.
- Si existe una actualización, se muestra un diálogo al usuario con la opción de **"Actualizar ahora"** o **"Más tarde"**.
- Al aceptar, se descarga el instalador, se instala y se reinicia la aplicación automáticamente.

### 4. Instalación inicial

Para la primera instalación en un equipo nuevo, descarga el archivo `.msi` desde la [página de Releases](https://github.com/diegocaceres21/certificacion-presupuestaria/releases/latest) y ejecútalo. Las actualizaciones posteriores se gestionan automáticamente desde la aplicación.

---

## Notas del proyecto

- La cuenta LICENCIAS DE SOFTWARE DE INVERSIONES se ha tomado como 12604 (activos intangibles).
- La cuenta 5311 se ha reducido únicamente a ADM de Sede, y la cuenta 5320 a DAS DE SEDE.