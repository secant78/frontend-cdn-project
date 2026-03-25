variable "env_name" {
  description = "Environment name (production or staging)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.env_name)
    error_message = "env_name must be 'production' or 'staging'."
  }
}

variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must be a valid AWS region (e.g. us-east-1)."
  }
}

variable "project_name" {
  description = "Project name prefix for all resource names"
  type        = string
  default     = "frontend-cdn"
}

variable "acm_cert_arn" {
  description = "ACM certificate ARN for custom domain HTTPS. Set to null to use the CloudFront default certificate."
  type        = string
  default     = null
}

# ─── Elastic Beanstalk ───────────────────────────────────────────────────────

variable "eb_instance_type" {
  description = "EC2 instance type for Elastic Beanstalk instances"
  type        = string
  default     = "t3.small"
}

variable "eb_min_instances" {
  description = "Minimum number of Elastic Beanstalk instances"
  type        = number
  default     = 1

  validation {
    condition     = var.eb_min_instances >= 1
    error_message = "eb_min_instances must be at least 1."
  }
}

variable "eb_max_instances" {
  description = "Maximum number of Elastic Beanstalk instances"
  type        = number
  default     = 4

  validation {
    condition     = var.eb_max_instances >= 1
    error_message = "eb_max_instances must be at least 1."
  }
}

# ─── WAF ─────────────────────────────────────────────────────────────────────

variable "waf_rate_limit" {
  description = "WAF IP rate limit — maximum requests per IP per 5-minute window (minimum 100)"
  type        = number
  default     = 2000

  validation {
    condition     = var.waf_rate_limit >= 100
    error_message = "waf_rate_limit must be at least 100 (AWS minimum)."
  }
}

# ─── CloudFront ───────────────────────────────────────────────────────────────

variable "cf_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.cf_price_class)
    error_message = "cf_price_class must be PriceClass_100, PriceClass_200, or PriceClass_All."
  }
}

variable "cf_assets_ttl" {
  description = "CloudFront TTL in seconds for /assets/* (hashed static files)"
  type        = number
  default     = 31536000 # 1 year
}

variable "cf_public_ttl" {
  description = "CloudFront TTL in seconds for /public/* files"
  type        = number
  default     = 86400 # 1 day
}

# DNS name of the ALB provisioned by the EKS Ingress resource.
# Leave null on the first apply. After running `kubectl apply -f k8s/ingress.yaml`
# and the LBC creates the ALB, set this to the ADDRESS from:
#   kubectl get ingress cruise-api-ingress -n cruise-services
# Then run `terraform apply` again to wire CloudFront to the EKS ALB.
variable "eks_alb_dns" {
  description = "EKS ALB DNS name (set after first kubectl apply of k8s/ingress.yaml)"
  type        = string
  default     = null
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the EKS VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

# ─── EKS ─────────────────────────────────────────────────────────────────────

variable "eks_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.30"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS managed node group (t3.medium minimum recommended)"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_desired" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "eks_node_min" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 1

  validation {
    condition     = var.eks_node_min >= 1
    error_message = "eks_node_min must be at least 1."
  }
}

variable "eks_node_max" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 4

  validation {
    condition     = var.eks_node_max >= 1
    error_message = "eks_node_max must be at least 1."
  }
}
