# Sufijo aleatorio para garantizar nombre único global de bucket S3
resource "random_string" "s3_suffix" {
  length  = 6
  special = false
  upper   = false
}

# -----------------------------------------------------------------------------
# 1. BUCKET S3 FRONTEND (Angular / SPA)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-frontend-${random_string.s3_suffix.result}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-frontend"
  }
}

# Bloquear todo el acceso público directo a S3 Frontend
resource "aws_s3_bucket_public_access_block" "frontend_block" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# 2. BUCKET S3 MULTIMEDIA (Evidencias fotográficas / Uploads)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "media" {
  bucket        = "${var.project_name}-media-${random_string.s3_suffix.result}"
  force_destroy = false

  tags = {
    Name = "${var.project_name}-media"
  }
}

# Bloquear acceso público directo (solo accesible vía CloudFront OAC y Backend IAM)
resource "aws_s3_bucket_public_access_block" "media_block" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Reglas CORS para visualización de multimedia desde la web y app
resource "aws_s3_bucket_cors_configuration" "media_cors" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# -----------------------------------------------------------------------------
# 3. CLOUDFRONT ORIGIN ACCESS CONTROL (OAC)
# -----------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-oac"
  description                       = "Origin Access Control para buckets S3 (Frontend y Media)"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# 4. DISTRIBUCIÓN CLOUDFRONT (Frontend, Media S3 y Proxy Backend EC2)
# -----------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "frontend_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Zonas de menor costo (Free Tier)

  # Origen 1: Archivos estáticos en S3 (Frontend Angular)
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  # Origen 2: Archivos multimedia en S3 (Fotos / Evidencias)
  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.media.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  # Origen 3: Servidor Backend EC2 en puerto 3000
  origin {
    domain_name = aws_eip.backend_eip.public_dns != "" ? aws_eip.backend_eip.public_dns : aws_eip.backend_eip.public_ip
    origin_id   = "EC2-Backend"

    custom_origin_config {
      http_port                = var.backend_port # 3000
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }
  }

  # Comportamiento por defecto: Servir la SPA desde S3 Frontend
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"

    # Managed Policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Comportamiento para la API REST (/api/*) hacia EC2 con HTTPS
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "EC2-Backend"

    viewer_protocol_policy = "redirect-to-https"

    # Managed Policy: CachingDisabled (para que la API responda siempre en tiempo real)
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # Managed Policy: AllViewerExceptHostHeader (reenvía auth headers, body, cookies y query strings)
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Comportamiento para WebSockets / Socket.IO (/socket.io/*)
  ordered_cache_behavior {
    path_pattern     = "/socket.io/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "EC2-Backend"

    viewer_protocol_policy = "redirect-to-https"

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Comportamiento para fotos/evidencias (/uploads/*) servidas directamente desde S3 Multimedia
  ordered_cache_behavior {
    path_pattern     = "/uploads/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media.id}"

    viewer_protocol_policy = "redirect-to-https"

    # Managed Policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Configuración para SPA (Single Page Application / Angular):
  # Redirige rutas 403 y 404 a index.html con HTTP 200 para que el router de Angular gestione la navegación
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado SSL/TLS por defecto que provee el dominio *.cloudfront.net
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-cloudfront"
  }
}

# -----------------------------------------------------------------------------
# 5. POLÍTICAS DE ACCESO S3 VÍA CLOUDFRONT OAC
# -----------------------------------------------------------------------------
# Política de bucket que permite a CloudFront leer archivos del frontend
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend_block]
}

# Política de bucket que permite a CloudFront leer archivos multimedia
resource "aws_s3_bucket_policy" "media_bucket_policy" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.media.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.media_block]
}
