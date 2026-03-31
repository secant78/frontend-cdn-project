# ══════════════════════════════════════════════════════════════════════════════
#  Production Environment
#  • Full-scale sizing with HA across 2 AZs
#  • Immutable CDN cache TTLs, higher WAF threshold
#  • NODE_ENV → "production"  (set automatically from env_name via locals.tf)
# ══════════════════════════════════════════════════════════════════════════════

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/infrastructure/terraform/modules/frontend-cdn"
}

inputs = {
  env_name = "production"

  # ── Networking ──────────────────────────────────────────────────────────────
  vpc_cidr = "10.2.0.0/16"

  # ── Elastic Beanstalk ───────────────────────────────────────────────────────
  eb_instance_type  = "t3.micro"
  eb_min_instances  = 2   # minimum 2 for HA across both AZs
  eb_max_instances  = 6

  # ── EKS ─────────────────────────────────────────────────────────────────────
  eks_version            = "1.30"
  eks_node_instance_type = "t3.large"
  eks_node_desired       = 2
  eks_node_min           = 2   # always 2+ nodes for HA
  eks_node_max           = 6

  # ── WAF ─────────────────────────────────────────────────────────────────────
  waf_rate_limit = 2000

  # ── CloudFront ──────────────────────────────────────────────────────────────
  cf_price_class = "PriceClass_100"
  cf_assets_ttl  = 31536000   # 1 year — hashed filenames make this safe
  cf_public_ttl  = 86400      # 1 day

  # ── Optional: set after kubectl apply creates the ALB ────────────────────────
  # eks_alb_dns  = "k8s-xxx.us-east-1.elb.amazonaws.com"
  # acm_cert_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/xxx"
  eks_alb_dns  = null
  acm_cert_arn = null
}
