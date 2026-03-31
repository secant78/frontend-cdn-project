data "aws_availability_zones" "available" {
  state = "available"
}

# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true  # required for EKS node-to-control-plane communication
  enable_dns_hostnames = true  # required for EKS node registration

  tags = merge(local.common_tags, {
    Name = "${local.eks_cluster_name}-vpc"
  })
}

# ─── Internet Gateway ─────────────────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.eks_cluster_name}-igw"
  })
}

# ─── Public Subnets ───────────────────────────────────────────────────────────
# Nodes run here (test project — no NAT gateway needed).
# ALBs also live in these subnets.

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, 0) # 10.0.0.0/20
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name                                              = "${local.eks_cluster_name}-public-1"
    "kubernetes.io/role/elb"                          = "1"
    "kubernetes.io/cluster/${local.eks_cluster_name}" = "shared"
  })
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, 1) # 10.0.16.0/20
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name                                              = "${local.eks_cluster_name}-public-2"
    "kubernetes.io/role/elb"                          = "1"
    "kubernetes.io/cluster/${local.eks_cluster_name}" = "shared"
  })
}

# ─── Route Table ─────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.eks_cluster_name}-rt-public"
  })
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}
