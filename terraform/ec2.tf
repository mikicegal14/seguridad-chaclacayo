# Obtener la AMI más reciente de Amazon Linux 2023
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Rol IAM para permitir conexión mediante AWS Systems Manager (SSM) sin necesidad de SSH
resource "aws_iam_role" "ec2_ssm_role" {
  name = "${var.project_name}-ec2-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_ssm_role.name
}

# Elastic IP para IP pública estática en el backend
resource "aws_eip" "backend_eip" {
  domain   = "vpc"
  instance = aws_instance.backend.id

  tags = {
    Name = "${var.project_name}-backend-eip"
  }
}

# Instancia EC2 Free Tier (t3.micro)
resource "aws_instance" "backend" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = var.ec2_instance_type # t3.micro (Free Tier)
  subnet_id            = aws_subnet.public_a.id
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name
  key_name             = var.ssh_key_name != "" ? var.ssh_key_name : null

  vpc_security_group_ids = [aws_security_group.ec2_sg.id]

  # Disco EBS (20 GB GP3, dentro del límite de 30 GB de Free Tier)
  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  # Script de inicialización automático (User Data)
  user_data = <<-EOF
              #!/bin/bash
              set -e
              dnf update -y
              dnf install -y git docker
              
              # Habilitar e iniciar servicio Docker
              systemctl enable docker
              systemctl start docker
              usermod -aG docker ec2-user

              # Instalar Docker Compose v2
              mkdir -p /usr/local/lib/docker/cli-plugins
              curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
              chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
              ln -s /usr/local/lib/docker/cli-plugins/docker-compose /usr/bin/docker-compose

              # Instalar Node.js 20 LTS (opcional si se corre nativo)
              dnf install -y nodejs

              # Crear directorio de la aplicación
              mkdir -p /app
              chown ec2-user:ec2-user /app

              echo "Instalación completada con éxito." > /app/install.log
              EOF

  tags = {
    Name = "${var.project_name}-backend-ec2"
  }
}
