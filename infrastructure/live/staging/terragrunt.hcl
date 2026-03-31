# ══════════════════════════════════════════════════════════════════════════════
#  Staging Environment
#  • Production-like config at reduced scale — mirror prod architecture
#    without the full cost footprint
#  • Used for integration tests, QA, and pre-release validation
#  • NODE_ENV → "staging"  (set automatically from env_name via locals.tf)
# ══════════════════════════════════════════════════════════════════════════════

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "${get_repo_root()}/infrastructure/terraform/modules/frontend-cdn"
}

inputs = {
  env_name = "staging"

  # ── Networking ──────────────────────────────────────────────────────────────
  vpc_cidr = "10.1.0.0/16"

  # ── Elastic Beanstalk ───────────────────────────────────────────────────────
  eb_instance_type  = "t3.micro"
  eb_min_instances  = 1
  eb_max_instances  = 3

  # ── EKS ─────────────────────────────────────────────────────────────────────
  eks_version            = "1.30"
  eks_node_instance_type = "t3.medium"
  eks_node_desired       = 2
  eks_node_min           = 1
  eks_node_max           = 3

  # ── WAF ─────────────────────────────────────────────────────────────────────
  waf_rate_limit = 1000

  # ── CloudFront ──────────────────────────────────────────────────────────────
  cf_price_class = "PriceClass_100"
  cf_assets_ttl  = 3600    # 1 hour — short enough to iterate, long enough to test CDN behaviour
  cf_public_ttl  = 300

  # ── Optional ─────────────────────────────────────────────────────────────────
  eks_alb_dns  = null
  acm_cert_arn = null
}
