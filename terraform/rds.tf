# DB Subnet Group que agrupa las subredes de la VPC para RDS
resource "aws_db_subnet_group" "rds" {
  name        = "${var.project_name}-rds-subnet-group"
  description = "Subnet group para la base de datos PostgreSQL"
  subnet_ids  = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "${var.project_name}-rds-subnet-group"
  }
}

# Instancia RDS PostgreSQL Free Tier
resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-db"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = var.db_instance_class # db.t3.micro (Free Tier)
  
  # Almacenamiento (20 GB es el límite mensual gratuito de AWS Free Tier)
  allocated_storage     = 20
  max_allocated_storage = 20 # Evita que el auto-scaling incremente costos
  storage_type          = "gp2"
  
  # Credenciales de base de datos
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Red y Seguridad
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false # Totalmente privada dentro de la VPC
  multi_az               = false # Single AZ requerido para Free Tier

  # Mantenimiento y Backups
  backup_retention_period   = 0 # Desactiva backups automáticos retenidos para evitar costos extra
  skip_final_snapshot       = true
  deletion_protection       = false
  auto_minor_version_upgrade = true

  tags = {
    Name = "${var.project_name}-postgres"
  }
}
