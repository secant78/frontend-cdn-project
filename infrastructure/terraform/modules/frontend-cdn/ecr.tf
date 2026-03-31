# ─── ECR Repositories ────────────────────────────────────────────────────────
# One repo per service. Images are built and pushed by the CI pipeline
# (05-deploy-services.yml) and pulled by EKS nodes at deploy time.

resource "aws_ecr_repository" "booking_service" {
  name                 = "${var.project_name}-booking-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "payment_service" {
  name                 = "${var.project_name}-payment-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# ── Lifecycle policies — keep only the 10 most recent images per repo ─────────
# Prevents unbounded ECR storage growth which adds cost over time.

resource "aws_ecr_lifecycle_policy" "booking_service" {
  repository = aws_ecr_repository.booking_service.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "payment_service" {
  repository = aws_ecr_repository.payment_service.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── Allow EKS nodes to pull images from these repos ──────────────────────────
# The node role already has AmazonEC2ContainerRegistryReadOnly attached
# (see eks.tf), which grants access to all ECR repos in the account.
# No additional policy needed here.
