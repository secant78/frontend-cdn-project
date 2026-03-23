terraform {
  required_version = ">= 1.6.0"

  # Terraform Cloud — replace YOUR_ORG_NAME with your Terraform Cloud organization
  cloud {
    organization = "YOUR_ORG_NAME"
    workspaces {
      name = "frontend-cdn-project"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }
}

# Primary provider
provider "aws" {
  region = var.aws_region
}

# Explicit us-east-1 alias — WAF for CloudFront scope must be us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Helm provider — connects to EKS cluster using AWS CLI token exchange
# Note: on first apply, run `terraform apply -target=aws_eks_node_group.main` first,
# then run a full `terraform apply` to install the Helm releases.
provider "helm" {
  kubernetes {
    host                   = aws_eks_cluster.main.endpoint
    cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", aws_eks_cluster.main.name]
    }
  }
}

# Kubernetes provider — same auth as Helm
provider "kubernetes" {
  host                   = aws_eks_cluster.main.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", aws_eks_cluster.main.name]
  }
}
