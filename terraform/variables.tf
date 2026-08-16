variable "aws_region" {
  description = "Región de AWS donde se desplegarán los recursos"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre base del proyecto"
  type        = string
  default     = "seguridad-chaclacayo"
}

variable "environment" {
  description = "Entorno de despliegue (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# --- EC2 (Backend) ---
variable "ec2_instance_type" {
  description = "Tipo de instancia EC2 (t3.micro o t2.micro elegibles para Free Tier)"
  type        = string
  default     = "t3.micro"
}

variable "backend_port" {
  description = "Puerto en el que se ejecuta el backend Node.js"
  type        = number
  default     = 3000
}

variable "ssh_key_name" {
  description = "Nombre del Key Pair en AWS para acceso SSH a la instancia EC2 (opcional si se usa AWS SSM)"
  type        = string
  default     = ""
}

variable "allowed_ssh_cidr" {
  description = "CIDR permitido para conectarse por SSH (ej: tu IP pública con /32)"
  type        = string
  default     = "0.0.0.0/0"
}

# --- RDS PostgreSQL ---
variable "db_instance_class" {
  description = "Clase de instancia para RDS (db.t3.micro o db.t4g.micro elegibles para Free Tier)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL inicial"
  type        = string
  default     = "seguridad_chaclacayo"
}

variable "db_username" {
  description = "Usuario administrador de la base de datos PostgreSQL"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Contraseña para el usuario administrador de PostgreSQL"
  type        = string
  sensitive   = true
  default     = "SecurityPassword2026!"
}
