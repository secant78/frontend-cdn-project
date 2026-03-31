output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "s3_static_assets_bucket" {
  description = "S3 bucket name for static assets (CSS, JS, images)"
  value       = aws_s3_bucket.static_assets.id
}

output "s3_eb_deployments_bucket" {
  description = "S3 bucket name for Elastic Beanstalk app bundles"
  value       = aws_s3_bucket.eb_deployments.id
}

output "eb_application_name" {
  description = "Elastic Beanstalk application name"
  value       = aws_elastic_beanstalk_application.main.name
}

output "eb_environment_name" {
  description = "Elastic Beanstalk environment name"
  value       = aws_elastic_beanstalk_environment.main.name
}

output "eb_environment_url" {
  description = "Elastic Beanstalk environment CNAME (used as CloudFront origin)"
  value       = aws_elastic_beanstalk_environment.main.endpoint_url
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN attached to CloudFront"
  value       = aws_wafv2_web_acl.main.arn
}

# ─── EKS ─────────────────────────────────────────────────────────────────────

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_certificate_authority" {
  description = "EKS cluster certificate authority data (base64)"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "eks_kubeconfig_command" {
  description = "Run this command to update your local kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}

output "lbc_iam_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller"
  value       = aws_iam_role.lbc.arn
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID for the EKS cluster"
  value       = aws_vpc.main.id
}

output "eks_private_subnet_ids" {
  description = "Private subnet IDs where EKS nodes run"
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

output "eks_public_subnet_ids" {
  description = "Public subnet IDs where ALBs are provisioned"
  value       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}
