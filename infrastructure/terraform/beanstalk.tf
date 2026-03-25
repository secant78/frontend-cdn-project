# Resolve the latest Node.js 20 solution stack at apply time
data "aws_elastic_beanstalk_solution_stack" "nodejs18" {
  most_recent = true
  name_regex  = "^64bit Amazon Linux 2023 .* running Node.js 20.*"
}

# ─── IAM: EC2 Instance Profile ───────────────────────────────────────────────

resource "aws_iam_role" "eb_instance_role" {
  name = "${var.project_name}-eb-instance-role-${var.env_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eb_web_tier" {
  role       = aws_iam_role.eb_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role_policy_attachment" "eb_worker_tier" {
  role       = aws_iam_role.eb_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWorkerTier"
}

resource "aws_iam_instance_profile" "eb_instance_profile" {
  name = "${var.project_name}-eb-instance-profile-${var.env_name}"
  role = aws_iam_role.eb_instance_role.name
}

# ─── IAM: EB Service Role ────────────────────────────────────────────────────

resource "aws_iam_role" "eb_service_role" {
  name = "${var.project_name}-eb-service-role-${var.env_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "elasticbeanstalk.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eb_enhanced_health" {
  role       = aws_iam_role.eb_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_role_policy_attachment" "eb_managed_updates" {
  role       = aws_iam_role.eb_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"
}

# ─── Elastic Beanstalk Application ───────────────────────────────────────────

resource "aws_elastic_beanstalk_application" "main" {
  name        = "${var.project_name}-app-${var.env_name}"
  description = "Frontend CDN Node.js application (${var.env_name})"
  tags        = local.common_tags
}

# ─── Elastic Beanstalk Environment ───────────────────────────────────────────

resource "aws_elastic_beanstalk_environment" "main" {
  name                = "${var.project_name}-env-${var.env_name}"
  application         = aws_elastic_beanstalk_application.main.name
  solution_stack_name = data.aws_elastic_beanstalk_solution_stack.nodejs18.name
  tier                = "WebServer"
  tags                = local.common_tags

  # ── VPC & Subnets ─────────────────────────────────────────────────────────
  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = aws_vpc.main.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = "${aws_subnet.public_1.id},${aws_subnet.public_2.id}"
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "ELBSubnets"
    value     = "${aws_subnet.public_1.id},${aws_subnet.public_2.id}"
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "ELBScheme"
    value     = "public"
  }

  # ── Environment type ──────────────────────────────────────────────────────
  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "LoadBalancerType"
    value     = "application"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.eb_service_role.arn
  }

  # ── Instance configuration ────────────────────────────────────────────────
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.eb_instance_type
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.eb_instance_profile.name
  }

  # ── Auto Scaling ──────────────────────────────────────────────────────────
  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MinSize"
    value     = tostring(var.eb_min_instances)
  }

  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MaxSize"
    value     = tostring(var.eb_max_instances)
  }

  # ── Application environment variables ─────────────────────────────────────
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NODE_ENV"
    value     = "production"
  }

  # ── Health reporting ──────────────────────────────────────────────────────
  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application"
    name      = "Application Healthcheck URL"
    value     = "/health"
  }

  # ── Proxy & static files ──────────────────────────────────────────────────
  setting {
    namespace = "aws:elasticbeanstalk:environment:proxy"
    name      = "ProxyServer"
    value     = "nginx"
  }

}
