# Despliegue de Infraestructura con Terraform en AWS (Free Tier)

Este módulo de Terraform despliega la infraestructura completa para la aplicación **Seguridad Chaclacayo** bajo la capa gratuita (Free Tier) de AWS:

1. **Frontend Web**: Bucket **AWS S3** privado + **AWS CloudFront** (con dominio HTTPS `*.cloudfront.net`, soporte para SPA Angular y Origin Access Control - OAC).
2. **Backend**: Instancia **EC2 `t3.micro`** con IP estática (Elastic IP), Docker, Docker Compose, Node.js y perfil IAM SSM para acceso seguro desde AWS Console sin exponer puertos SSH si se prefiere.
3. **Base de Datos**: Instancia **RDS PostgreSQL `db.t3.micro`** (20 GB SSD GP2, Single-AZ) protegida en red privada, accesible exclusivamente desde el backend en EC2.

---

## 📋 Requisitos Previos

- [Terraform](https://developer.hashicorp.com/terraform/downloads) instalado (v1.5+).
- [AWS CLI](https://aws.amazon.com/cli/) instalado y configurado (`aws configure`).
- Permisos adecuados en tu cuenta de AWS (Administrador o permisos sobre EC2, VPC, RDS, S3, CloudFront, IAM).

---

## 🚀 Guía de Despliegue Paso a Paso

### 1. Configurar Variables

Copia el archivo de ejemplo y personaliza tus credenciales:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edita `terraform.tfvars` (especialmente `db_password` y `aws_region`).

---

### 2. Inicializar y Aplicar Terraform

```bash
# Inicializar providers y módulos
terraform init

# Revisar los recursos a crear
terraform plan

# Aplicar y crear los recursos en AWS
terraform apply
```

Al finalizar, Terraform mostrará los valores de salida (`Outputs`), incluyendo:
- `cloudfront_url`: Tu URL pública HTTPS del frontend.
- `backend_api_url`: URL de la API de Node.js en EC2.
- `rds_host`: Dirección del host de la base de datos PostgreSQL.
- `s3_bucket_name`: Nombre del bucket para subir el build de Angular.

---

### 3. Compilar y Subir el Frontend (Angular) a S3

Compila el frontend y sube los archivos estáticos al bucket creado:

```bash
# 1. Compilar Angular en modo producción
cd ../frontend
npm run build -- --configuration production

# 2. Sincronizar archivos al bucket S3 (reemplaza <S3_BUCKET_NAME> por el output de terraform)
aws s3 sync dist/seguridad-chaclacayo/browser s3://<S3_BUCKET_NAME> --delete

# 3. (Opcional) Invalidar caché de CloudFront para ver cambios inmediatamente
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

---

### 4. Configurar el Backend en la Instancia EC2

Puedes conectarte a la instancia mediante **AWS Systems Manager Session Manager** (desde la consola de AWS o CLI) o por **SSH**:

```bash
# Conectar por SSH (si configuraste ssh_key_name)
ssh -i /ruta/a/tu-llave.pem ec2-user@<EC2_PUBLIC_IP>
```

Una vez dentro de la máquina:

```bash
cd /app
# Clonar repositorio o copiar código del backend
git clone <URL_REPOSITORIO> .
cd backend

# Crear el archivo .env con los outputs de Terraform:
cat <<EOT > .env
PORT=3000
DB_HOST=<RDS_HOST>
DB_PORT=5432
DB_NAME=seguridad_chaclacayo
DB_USER=postgres
DB_PASSWORD=<TU_PASSWORD>
NODE_ENV=production
CORS_ORIGIN=https://<CLOUDFRONT_DOMAIN>
JWT_SECRET=un_secreto_muy_seguro_para_jwt
EOT

# Ejecutar con Docker o PM2/Node
docker build -t backend-app .
docker run -d -p 3000:3000 --name backend-service --env-file .env backend-app
```

---

## 🧹 Destrucción de Recursos

Si necesitas eliminar toda la infraestructura para no generar ningún costo:

```bash
terraform destroy
```
