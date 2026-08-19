# --- Frontend & Media Outputs ---
output "cloudfront_url" {
  description = "URL HTTPS pública provista por CloudFront para el Frontend"
  value       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"
}

output "cloudfront_domain_name" {
  description = "Nombre de dominio de CloudFront"
  value       = aws_cloudfront_distribution.frontend_distribution.domain_name
}

output "s3_bucket_name" {
  description = "Nombre del bucket S3 para desplegar la compilación del frontend"
  value       = aws_s3_bucket.frontend.id
}

output "s3_media_bucket_name" {
  description = "Nombre del bucket S3 para almacenamiento de evidencias multimedia"
  value       = aws_s3_bucket.media.id
}

output "media_url" {
  description = "URL base pública para acceder a las fotos/evidencias vía CloudFront HTTPS"
  value       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}/uploads"
}

output "s3_sync_command" {
  description = "Comando de AWS CLI para sincronizar la carpeta dist de Angular a S3"
  value       = "aws s3 sync ../frontend/dist/frontend/browser s3://${aws_s3_bucket.frontend.id} --delete"
}

# --- Backend Outputs ---
output "ec2_public_ip" {
  description = "IP pública estática de la instancia EC2"
  value       = aws_eip.backend_eip.public_ip
}

output "backend_api_url" {
  description = "URL para acceder a la API del backend"
  value       = "http://${aws_eip.backend_eip.public_ip}:${var.backend_port}"
}

output "ec2_instance_id" {
  description = "ID de la instancia EC2 para conectarse por AWS SSM"
  value       = aws_instance.backend.id
}

# --- Database Outputs ---
output "rds_endpoint" {
  description = "Endpoint completo de conexión de PostgreSQL RDS"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_host" {
  description = "Host de la base de datos PostgreSQL RDS"
  value       = aws_db_instance.postgres.address
}

output "rds_database_name" {
  description = "Nombre de la base de datos"
  value       = aws_db_instance.postgres.db_name
}

output "suggested_backend_env" {
  description = "Variables sugeridas para el archivo .env del backend en producción"
  value       = <<-EOT
    PORT=${var.backend_port}
    DB_HOST=${aws_db_instance.postgres.address}
    DB_PORT=5432
    DB_NAME=${aws_db_instance.postgres.db_name}
    DB_USER=${var.db_username}
    DB_PASSWORD=${var.db_password}
    NODE_ENV=production
    CORS_ORIGIN=https://${aws_cloudfront_distribution.frontend_distribution.domain_name}
    S3_BUCKET_MEDIA=${aws_s3_bucket.media.id}
    AWS_REGION=${var.aws_region}
    CLOUDFRONT_MEDIA_URL=https://${aws_cloudfront_distribution.frontend_distribution.domain_name}
  EOT
  sensitive   = true
}
