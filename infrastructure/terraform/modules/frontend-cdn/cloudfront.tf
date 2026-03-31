# ─── Cache Policies (replaces deprecated forwarded_values) ───────────────────

# 1-year immutable cache for hashed /assets/* files
resource "aws_cloudfront_cache_policy" "assets_immutable" {
  name        = "${var.project_name}-assets-immutable-${var.env_name}"
  min_ttl     = var.cf_assets_ttl
  default_ttl = var.cf_assets_ttl
  max_ttl     = var.cf_assets_ttl

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# 1-day cache for /public/* HTML and media files
resource "aws_cloudfront_cache_policy" "public_files" {
  name        = "${var.project_name}-public-files-${var.env_name}"
  min_ttl     = 0
  default_ttl = var.cf_public_ttl
  max_ttl     = var.cf_public_ttl

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# ─── Origin Request Policy (EB dynamic origin) ───────────────────────────────

# Forward cookies, relevant headers, and all query strings to EB
resource "aws_cloudfront_origin_request_policy" "eb_dynamic" {
  name = "${var.project_name}-eb-origin-request-${var.env_name}"

  cookies_config {
    cookie_behavior = "all"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Accept", "Accept-Language", "CloudFront-Forwarded-Proto"]
    }
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# ─── Origin Access Control ───────────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.project_name}-s3-oac-${var.env_name}"
  description                       = "OAC for private S3 static assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── CloudFront Distribution ─────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  comment         = "${var.project_name} distribution (${var.env_name})"
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  price_class     = var.cf_price_class
  web_acl_id      = aws_wafv2_web_acl.main.arn

  # ── Origins ───────────────────────────────────────────────────────────────

  # EKS ALB — only added after Phase 2 (eks_alb_dns is set post-kubectl-apply)
  dynamic "origin" {
    for_each = var.eks_alb_dns != null ? [var.eks_alb_dns] : []
    content {
      origin_id   = "eks-alb"
      domain_name = origin.value

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # S3 private bucket — accessed via OAC (no public access)
  origin {
    origin_id                = "s3-static-assets"
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  # Elastic Beanstalk ALB — HTTP custom origin
  origin {
    origin_id   = "elastic-beanstalk"
    domain_name = aws_elastic_beanstalk_environment.main.endpoint_url

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ── Cache Behaviors ───────────────────────────────────────────────────────

  # /api/* — microservices on EKS (only active after Phase 2)
  dynamic "ordered_cache_behavior" {
    for_each = var.eks_alb_dns != null ? [var.eks_alb_dns] : []
    content {
      path_pattern             = "/api/*"
      target_origin_id         = "eks-alb"
      viewer_protocol_policy   = "redirect-to-https"
      compress                 = true
      allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled (managed)
      origin_request_policy_id = aws_cloudfront_origin_request_policy.eb_dynamic.id
    }
  }

  # /assets/* — hashed static files, 1-year immutable cache
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-static-assets"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.assets_immutable.id
  }

  # /public/* — HTML and media files, 1-day cache
  ordered_cache_behavior {
    path_pattern           = "/public/*"
    target_origin_id       = "s3-static-assets"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.public_files.id
  }

  # /* default — dynamic content routed to Elastic Beanstalk, no cache
  # Uses managed CachingDisabled policy (4135ea2d-...)
  default_cache_behavior {
    target_origin_id          = "elastic-beanstalk"
    viewer_protocol_policy    = "redirect-to-https"
    compress                  = true
    allowed_methods           = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods            = ["GET", "HEAD"]
    cache_policy_id           = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled (managed)
    origin_request_policy_id  = aws_cloudfront_origin_request_policy.eb_dynamic.id
  }

  # ── Custom Error Responses ────────────────────────────────────────────────

  # SPA fallback: 404/403 from origins → serve index.html with 200
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  # ── TLS / Viewer Certificate ──────────────────────────────────────────────

  dynamic "viewer_certificate" {
    for_each = var.acm_cert_arn != null ? [1] : []
    content {
      acm_certificate_arn      = var.acm_cert_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.acm_cert_arn == null ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = local.common_tags
}
