# ══════════════════════════════════════════════════════════════════════════════
#  Root Terragrunt Configuration
#  Inherited by every environment via:  include "root" { path = find_in_parent_folders() }
#
#  This file is the single place to change:
#   • Remote state backend (S3 + DynamoDB)
#   • AWS region
#   • Project name prefix
#   • Provider generation
# ══════════════════════════════════════════════════════════════════════════════

locals {
  aws_region   = "us-east-1"
  project_name = "frontend-cdn"
}

# ─── Remote State ─────────────────────────────────────────────────────────────
# One S3 bucket for all environments; each env gets its own state key:
#   dev/terraform.tfstate
#   staging/terraform.tfstate
#   prod/terraform.tfstate
#
# Terragrunt creates the bucket and DynamoDB table automatically on first run.
# The bucket name embeds the AWS account ID for global uniqueness.

remote_state {
  backend = "s3"

  config = {
    bucket = "${local.project_name}-tfstate-${get_aws_account_id()}"

    # path_relative_to_include() returns the env folder name (dev / staging / prod)
    key    = "${path_relative_to_include()}/terraform.tfstate"

    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "${local.project_name}-tfstate-locks"

    s3_bucket_tags = {
      Project   = local.project_name
      ManagedBy = "terragrunt"
    }

    dynamodb_table_tags = {
      Project   = local.project_name
      ManagedBy = "terragrunt"
    }
  }

  # Terragrunt writes this file into the module's working directory at plan time.
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# ─── Common Inputs ────────────────────────────────────────────────────────────
# Values that are the same for every environment.
# Environment-specific values live in each env's own terragrunt.hcl.

inputs = {
  aws_region   = local.aws_region
  project_name = local.project_name
}
