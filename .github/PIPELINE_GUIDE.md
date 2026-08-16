# 🚀 Guía del Pipeline CI/CD (GitHub Actions)

Este pipeline permite desplegar con **un solo clic** (o de manera independiente) los 3 componentes del proyecto:
1. 🌐 **Frontend Web**: Compila Angular en producción, sincroniza con **AWS S3** e invalida el caché en **AWS CloudFront**.
2. ⚙️ **Backend**: Conecta vía SSH a la instancia **EC2**, actualiza código, regenera `.env` y reinicia el contenedor **Docker**.
3. 📱 **Android APK**: Compila con Gradle (Java 17) y sube el archivo `.apk` como un artefacto descargable directamente desde GitHub.

---

## 🔑 Secretos Requeridos en GitHub (Repository Secrets)

Para configurar los secretos, ve a tu repositorio en GitHub:  
👉 **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.

| Secreto | Descripción | Ejemplo / Origen |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Clave de acceso IAM de AWS | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Clave secreta IAM de AWS | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Región de AWS (opcional, default `us-east-1`) | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | Nombre del bucket S3 del frontend | Output de Terraform (`s3_bucket_name`) |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID de la distribución de CloudFront | `E1234567890ABC` |
| `EC2_HOST` | IP Pública de la instancia EC2 | Output de Terraform (`ec2_public_ip`) |
| `EC2_USER` | Usuario de la máquina EC2 | `ec2-user` |
| `EC2_SSH_KEY` | Contenido de tu clave privada SSH (.pem) | `-----BEGIN RSA PRIVATE KEY----- ...` |
| `DB_HOST` | Host de la base de datos RDS PostgreSQL | Output de Terraform (`rds_host`) |
| `DB_PASSWORD` | Contraseña de PostgreSQL RDS | Tu contraseña configurada |
| `JWT_SECRET` | Secreto para firmas JWT del backend | `clave_secreta_jwt_muy_segura` |
| `CORS_ORIGIN` | URL del frontend en CloudFront | `https://dXXXXXXXXX.cloudfront.net` |

---

## 🖱️ ¿Cómo Ejecutar en 1 Clic?

1. En GitHub, ve a la pestaña **Actions**.
2. En la lista izquierda, selecciona **"CI/CD Deploy Suite (Frontend, Backend & Android APK)"**.
3. Haz clic en el botón desplegable **"Run workflow"**.
4. Deja la opción **"⚡ Desplegar TODO (Frontend, Backend y APK en 1 clic)"** activa o marca/desmarca individualmente los que desees.
5. Presiona el botón verde **"Run workflow"**.

---

## 📥 ¿Dónde descargar el APK generado?

1. En la misma ejecución de la pestaña **Actions**, una vez finalizado el job **📱 Generar APK Android**:
2. Baja a la sección **Artifacts** al pie de la página.
3. Haz clic en `citizen-security-debug-apk` o `citizen-security-release-apk` para descargarlo inmediatamente a tu dispositivo o computadora.
