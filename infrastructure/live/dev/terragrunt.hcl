# ══════════════════════════════════════════════════════════════════════════════
#  Dev Environment
#  • Smallest / cheapest sizing — safe for feature work and experimentation
#  • Single EB instance, single EKS node, lower WAF threshold
#  • NODE_ENV → "development"  (set automatically from env_name via locals.tf)
# ══════════════════════════════════════════════════════════════════════════════

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/infrastructure/terraform/modules/frontend-cdn"
}

inputs = {
  env_name = "dev"

  # ── Networking ──────────────────────────────────────────────────────────────
  # Non-overlapping CIDR so dev/staging/prod can be peered in the future.
  vpc_cidr = "10.0.0.0/16"

  # ── Elastic Beanstalk ───────────────────────────────────────────────────────
  eb_instance_type  = "t3.micro"
  eb_min_instances  = 1
  eb_max_instances  = 2

  # ── EKS ─────────────────────────────────────────────────────────────────────
  eks_version            = "1.30"
  eks_node_instance_type = "t3.small"
  eks_node_desired       = 1
  eks_node_min           = 1
  eks_node_max           = 2

  # ── WAF ─────────────────────────────────────────────────────────────────────
  waf_rate_limit = 500   # relaxed — dev traffic is internal / low volume

  # ── CloudFront ──────────────────────────────────────────────────────────────
  cf_price_class = "PriceClass_100"   # US/EU edge locations only
  cf_assets_ttl  = 300                # short TTL — assets change often in dev
  cf_public_ttl  = 60

  # ── Optional: set after kubectl apply creates the ALB ────────────────────────
  eks_alb_dns  = null
  acm_cert_arn = null
}
