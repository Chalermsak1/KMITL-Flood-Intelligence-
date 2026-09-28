output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.api.dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL writer endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "sqs_queue_url" {
  description = "SQS Queue URL for background worker processing"
  value       = aws_sqs_queue.jobs_queue.url
}

output "s3_evidence_bucket" {
  description = "S3 Bucket for photo evidence storage"
  value       = aws_s3_bucket.flood_photos.id
}
