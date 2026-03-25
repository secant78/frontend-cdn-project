locals {
  static_assets_bucket  = "${var.project_name}-static-assets-${var.env_name}"
  eb_deployments_bucket = "elasticbeanstalk-${var.project_name}-${var.env_name}"
  eks_cluster_name      = "${var.project_name}-eks-${var.env_name}"

  common_tags = {
    Project     = var.project_name
    Environment = var.env_name
    ManagedBy   = "terraform"
  }
}
