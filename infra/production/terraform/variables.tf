variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "ap-southeast-1" # Bangkok adjacent (Singapore) or ap-southeast-7 (Thailand)
}

variable "environment" {
  description = "Environment stage (staging or production)"
  type        = string
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
}
