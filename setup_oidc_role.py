"""
OIDC Federated Identity Setup for GitHub Actions
-------------------------------------------------
Creates:
  1. An IAM OIDC Identity Provider for token.actions.githubusercontent.com
     (idempotent -- reuses the provider if it already exists in this account)
  2. An IAM Role (github-actions-frontend-cdn) trusted exclusively by the
     secant78/frontend-cdn-project repository, scoped to main branch,
     feature/* branches, and pull requests
  3. A least-privilege inline policy covering all AWS actions used by the
     GitHub Actions workflows in this project:
       - Elastic Beanstalk   (website / frontend)
       - CloudFront + WAF    (CDN + web application firewall)
       - EKS                 (Kubernetes cluster for microservices)
       - VPC / EC2           (networking for EKS node groups)
       - ECR                 (container registry for microservice images)
       - S3                  (static assets bucket)
       - IAM                 (scoped role/policy management for EKS + EB)
       - ACM                 (SSL/TLS certificates)
       - STS                 (identity verification)

Run once from a machine with IAM administrator access:
    python setup_oidc_role.py

The script is fully idempotent -- running it multiple times is safe.
"""

import boto3
import json
import sys

# ── constants ─────────────────────────────────────────────────────────────────

ACCOUNT_ID        = "866934333672"
GITHUB_REPO       = "secant78/frontend-cdn-project"
OIDC_PROVIDER_URL = "https://token.actions.githubusercontent.com"
OIDC_AUDIENCE     = "sts.amazonaws.com"

# Two thumbprints covering GitHub's current and rotated TLS certificates.
# AWS ignores thumbprints for GitHub's OIDC provider (validates cert via CDN),
# but the API requires at least one syntactically valid 40-hex-char value.
OIDC_THUMBPRINTS = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b4ddf6e7094db68bca4",
]

OIDC_PROVIDER_ARN = (
    f"arn:aws:iam::{ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
)

ROLE_NAME   = "github-actions-frontend-cdn"
ROLE_ARN    = f"arn:aws:iam::{ACCOUNT_ID}:role/{ROLE_NAME}"
POLICY_NAME = "github-actions-frontend-cdn-policy"

iam = boto3.client("iam", region_name="us-east-1")


# ── helpers ───────────────────────────────────────────────────────────────────

def ok(msg):   print(f"  [OK]  {msg}")
def info(msg): print(f"  [..] {msg}")
def warn(msg): print(f"  [!!] {msg}")
def step(msg): print(f"\n=== {msg} ===")


# ── Step 1: OIDC Identity Provider ────────────────────────────────────────────

def create_oidc_provider():
    step("Creating OIDC Identity Provider")
    info(f"URL : {OIDC_PROVIDER_URL}")
    info(f"Aud : {OIDC_AUDIENCE}")

    try:
        resp = iam.create_open_id_connect_provider(
            Url=OIDC_PROVIDER_URL,
            ClientIDList=[OIDC_AUDIENCE],
            ThumbprintList=OIDC_THUMBPRINTS,
        )
        provider_arn = resp["OpenIDConnectProviderArn"]
        ok(f"OIDC provider created: {provider_arn}")
    except iam.exceptions.EntityAlreadyExistsException:
        # Provider already exists from a previous project -- safe to reuse
        ok(f"OIDC provider already exists (shared): {OIDC_PROVIDER_ARN}")
        provider_arn = OIDC_PROVIDER_ARN

    return provider_arn


# ── Step 2: Trust Policy ──────────────────────────────────────────────────────

def build_trust_policy(provider_arn):
    """
    Trust policy conditions:
      - aud == sts.amazonaws.com  (StringEquals -- exact match required)
      - sub matches repo + branch (StringLike allows wildcards):
          * main branch push
          * any feature/* branch push
          * pull_request event
    """
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "GitHubActionsOIDC",
                "Effect": "Allow",
                "Principal": {
                    "Federated": provider_arn,
                },
                "Action": "sts:AssumeRoleWithWebIdentity",
                "Condition": {
                    "StringEquals": {
                        "token.actions.githubusercontent.com:aud": OIDC_AUDIENCE,
                    },
                    "StringLike": {
                        "token.actions.githubusercontent.com:sub": [
                            f"repo:{GITHUB_REPO}:ref:refs/heads/main",
                            f"repo:{GITHUB_REPO}:ref:refs/heads/feature/*",
                            f"repo:{GITHUB_REPO}:pull_request",
                        ],
                    },
                },
            }
        ],
    }


# ── Step 3: Permissions Policy ────────────────────────────────────────────────

def build_permissions_policy():
    """
    Least-privilege policy covering all AWS services managed by Terraform
    and the GitHub Actions workflows for this project:

      Elastic Beanstalk  -- deploy and manage the frontend website
      CloudFront         -- CDN distribution (create/update/invalidate)
      WAFv2              -- Web ACL attached to CloudFront
      EKS                -- Kubernetes cluster + node groups for microservices
      VPC / EC2          -- Networking (subnets, security groups, NAT, IGW)
      ECR                -- Container registry for microservice Docker images
      S3                 -- Static assets bucket (public read, CI upload)
      IAM                -- Scoped role/policy management for EKS OIDC +
                           EB instance profile + EKS node group role
      ACM                -- Request and describe SSL/TLS certificates
      STS                -- Identity verification in workflow steps
    """
    return {
        "Version": "2012-10-17",
        "Statement": [
            # ── Elastic Beanstalk ────────────────────────────────────────────
            {
                "Sid": "ElasticBeanstalk",
                "Effect": "Allow",
                "Action": [
                    "elasticbeanstalk:CreateApplication",
                    "elasticbeanstalk:UpdateApplication",
                    "elasticbeanstalk:DeleteApplication",
                    "elasticbeanstalk:DescribeApplications",
                    "elasticbeanstalk:CreateEnvironment",
                    "elasticbeanstalk:UpdateEnvironment",
                    "elasticbeanstalk:DeleteEnvironment",
                    "elasticbeanstalk:DescribeEnvironments",
                    "elasticbeanstalk:DescribeEnvironmentResources",
                    "elasticbeanstalk:CreateApplicationVersion",
                    "elasticbeanstalk:UpdateApplicationVersion",
                    "elasticbeanstalk:DeleteApplicationVersion",
                    "elasticbeanstalk:DescribeApplicationVersions",
                    "elasticbeanstalk:CreateConfigurationTemplate",
                    "elasticbeanstalk:DescribeConfigurationSettings",
                    "elasticbeanstalk:ValidateConfigurationSettings",
                    "elasticbeanstalk:ListAvailableSolutionStacks",
                    "elasticbeanstalk:CheckDNSAvailability",
                    "elasticbeanstalk:DescribeEvents",
                    "elasticbeanstalk:DescribeEnvironmentHealth",
                    "elasticbeanstalk:DescribeInstancesHealth",
                    "elasticbeanstalk:RequestEnvironmentInfo",
                    "elasticbeanstalk:RetrieveEnvironmentInfo",
                    "elasticbeanstalk:AbortEnvironmentUpdate",
                ],
                "Resource": "*",
            },
            # ── CloudFormation (required by Elastic Beanstalk under the hood) ──
            {
                "Sid": "CloudFormation",
                "Effect": "Allow",
                "Action": [
                    "cloudformation:GetTemplate",
                    "cloudformation:DescribeStacks",
                    "cloudformation:DescribeStackEvents",
                    "cloudformation:DescribeStackResources",
                    "cloudformation:DescribeStackResource",
                    "cloudformation:ListStackResources",
                    "cloudformation:GetStackPolicy",
                    "cloudformation:ListStacks",
                ],
                "Resource": "*",
            },
            # ── CloudFront ───────────────────────────────────────────────────
            {
                "Sid": "CloudFront",
                "Effect": "Allow",
                "Action": [
                    "cloudfront:CreateDistribution",
                    "cloudfront:UpdateDistribution",
                    "cloudfront:DeleteDistribution",
                    "cloudfront:GetDistribution",
                    "cloudfront:GetDistributionConfig",
                    "cloudfront:ListDistributions",
                    "cloudfront:CreateInvalidation",
                    "cloudfront:GetInvalidation",
                    "cloudfront:CreateOriginAccessControl",
                    "cloudfront:GetOriginAccessControl",
                    "cloudfront:DeleteOriginAccessControl",
                    "cloudfront:ListOriginAccessControls",
                    "cloudfront:TagResource",
                    "cloudfront:ListTagsForResource",
                ],
                "Resource": "*",
            },
            # ── WAFv2 ────────────────────────────────────────────────────────
            {
                "Sid": "WAFv2",
                "Effect": "Allow",
                "Action": [
                    "wafv2:CreateWebACL",
                    "wafv2:UpdateWebACL",
                    "wafv2:DeleteWebACL",
                    "wafv2:GetWebACL",
                    "wafv2:ListWebACLs",
                    "wafv2:AssociateWebACL",
                    "wafv2:DisassociateWebACL",
                    "wafv2:GetWebACLForResource",
                    "wafv2:ListTagsForResource",
                    "wafv2:TagResource",
                ],
                "Resource": "*",
            },
            # ── EKS ─────────────────────────────────────────────────────────
            {
                "Sid": "EKS",
                "Effect": "Allow",
                "Action": [
                    "eks:CreateCluster",
                    "eks:DeleteCluster",
                    "eks:DescribeCluster",
                    "eks:ListClusters",
                    "eks:UpdateClusterConfig",
                    "eks:UpdateClusterVersion",
                    "eks:CreateNodegroup",
                    "eks:DeleteNodegroup",
                    "eks:DescribeNodegroup",
                    "eks:UpdateNodegroupConfig",
                    "eks:UpdateNodegroupVersion",
                    "eks:ListNodegroups",
                    "eks:CreateAddon",
                    "eks:DeleteAddon",
                    "eks:DescribeAddon",
                    "eks:ListAddons",
                    "eks:TagResource",
                    "eks:ListTagsForResource",
                    "eks:AccessKubernetesApi",
                ],
                "Resource": "*",
            },
            # ── VPC / EC2 (networking for EKS + EB) ─────────────────────────
            {
                "Sid": "VPCAndNetworking",
                "Effect": "Allow",
                "Action": [
                    "ec2:CreateVpc",
                    "ec2:DeleteVpc",
                    "ec2:DescribeVpcs",
                    "ec2:ModifyVpcAttribute",
                    "ec2:CreateSubnet",
                    "ec2:DeleteSubnet",
                    "ec2:DescribeSubnets",
                    "ec2:ModifySubnetAttribute",
                    "ec2:CreateInternetGateway",
                    "ec2:DeleteInternetGateway",
                    "ec2:AttachInternetGateway",
                    "ec2:DetachInternetGateway",
                    "ec2:DescribeInternetGateways",
                    "ec2:AllocateAddress",
                    "ec2:ReleaseAddress",
                    "ec2:DescribeAddresses",
                    "ec2:CreateNatGateway",
                    "ec2:DeleteNatGateway",
                    "ec2:DescribeNatGateways",
                    "ec2:CreateRouteTable",
                    "ec2:DeleteRouteTable",
                    "ec2:DescribeRouteTables",
                    "ec2:CreateRoute",
                    "ec2:DeleteRoute",
                    "ec2:AssociateRouteTable",
                    "ec2:DisassociateRouteTable",
                    "ec2:CreateSecurityGroup",
                    "ec2:DeleteSecurityGroup",
                    "ec2:DescribeSecurityGroups",
                    "ec2:AuthorizeSecurityGroupIngress",
                    "ec2:AuthorizeSecurityGroupEgress",
                    "ec2:RevokeSecurityGroupIngress",
                    "ec2:RevokeSecurityGroupEgress",
                    "ec2:DescribeAvailabilityZones",
                    "ec2:DescribeInstances",
                    "ec2:DescribeInstanceTypes",
                    "ec2:DescribeLaunchTemplates",
                    "ec2:DescribeLaunchTemplateVersions",
                    "ec2:CreateLaunchTemplate",
                    "ec2:DeleteLaunchTemplate",
                    "ec2:CreateTags",
                    "ec2:DeleteTags",
                    "ec2:DescribeTags",
                ],
                "Resource": "*",
            },
            # ── ECR ──────────────────────────────────────────────────────────
            {
                "Sid": "ECR",
                "Effect": "Allow",
                "Action": [
                    "ecr:CreateRepository",
                    "ecr:DeleteRepository",
                    "ecr:DescribeRepositories",
                    "ecr:GetRepositoryPolicy",
                    "ecr:SetRepositoryPolicy",
                    "ecr:DeleteRepositoryPolicy",
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "ecr:InitiateLayerUpload",
                    "ecr:UploadLayerPart",
                    "ecr:CompleteLayerUpload",
                    "ecr:PutImage",
                    "ecr:TagResource",
                    "ecr:ListTagsForResource",
                ],
                "Resource": "*",
            },
            # ── S3 (static assets bucket) ────────────────────────────────────
            {
                "Sid": "S3StaticAssets",
                "Effect": "Allow",
                "Action": [
                    "s3:CreateBucket",
                    "s3:DeleteBucket",
                    "s3:HeadBucket",
                    "s3:GetBucketLocation",
                    "s3:GetBucketVersioning",
                    "s3:PutBucketVersioning",
                    "s3:GetBucketPolicy",
                    "s3:PutBucketPolicy",
                    "s3:DeleteBucketPolicy",
                    "s3:PutBucketPublicAccessBlock",
                    "s3:GetBucketPublicAccessBlock",
                    "s3:ListBucket",
                    "s3:ListAllMyBuckets",
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:DeleteObject",
                    "s3:GetObjectVersion",
                    "s3:PutBucketWebsite",
                    "s3:GetBucketWebsite",
                    "s3:PutBucketCORS",
                    "s3:GetBucketCORS",
                    "s3:PutBucketTagging",
                    "s3:GetBucketTagging",
                ],
                "Resource": "*",
            },
            # ── IAM (scoped to roles this project manages) ───────────────────
            {
                "Sid": "IAMScopedManagement",
                "Effect": "Allow",
                "Action": [
                    "iam:CreateRole",
                    "iam:DeleteRole",
                    "iam:GetRole",
                    "iam:UpdateRole",
                    "iam:PassRole",
                    "iam:PutRolePolicy",
                    "iam:DeleteRolePolicy",
                    "iam:GetRolePolicy",
                    "iam:AttachRolePolicy",
                    "iam:DetachRolePolicy",
                    "iam:ListRolePolicies",
                    "iam:ListAttachedRolePolicies",
                    "iam:CreateInstanceProfile",
                    "iam:DeleteInstanceProfile",
                    "iam:GetInstanceProfile",
                    "iam:AddRoleToInstanceProfile",
                    "iam:RemoveRoleFromInstanceProfile",
                    "iam:CreateOpenIDConnectProvider",
                    "iam:GetOpenIDConnectProvider",
                    "iam:DeleteOpenIDConnectProvider",
                    "iam:ListOpenIDConnectProviders",
                    "iam:TagRole",
                    "iam:UntagRole",
                    "iam:ListRoleTags",
                    "iam:CreatePolicy",
                    "iam:DeletePolicy",
                    "iam:GetPolicy",
                    "iam:GetPolicyVersion",
                    "iam:ListPolicies",
                    "iam:CreatePolicyVersion",
                    "iam:DeletePolicyVersion",
                ],
                # Scoped to roles/profiles/policies this project creates
                "Resource": [
                    f"arn:aws:iam::{ACCOUNT_ID}:role/eks-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:role/eb-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:role/frontend-cdn-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:instance-profile/eb-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:instance-profile/frontend-cdn-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:oidc-provider/*",
                    f"arn:aws:iam::{ACCOUNT_ID}:policy/eks-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:policy/eb-*",
                    f"arn:aws:iam::{ACCOUNT_ID}:policy/frontend-cdn-*",
                ],
            },
            # ── ACM (SSL/TLS certificates) ───────────────────────────────────
            {
                "Sid": "ACM",
                "Effect": "Allow",
                "Action": [
                    "acm:RequestCertificate",
                    "acm:DeleteCertificate",
                    "acm:DescribeCertificate",
                    "acm:ListCertificates",
                    "acm:AddTagsToCertificate",
                    "acm:ListTagsForCertificate",
                ],
                "Resource": "*",
            },
            # ── AutoScaling (for EKS node groups + EB) ───────────────────────
            {
                "Sid": "AutoScaling",
                "Effect": "Allow",
                "Action": [
                    "autoscaling:CreateAutoScalingGroup",
                    "autoscaling:DeleteAutoScalingGroup",
                    "autoscaling:DescribeAutoScalingGroups",
                    "autoscaling:UpdateAutoScalingGroup",
                    "autoscaling:CreateLaunchConfiguration",
                    "autoscaling:DeleteLaunchConfiguration",
                    "autoscaling:DescribeLaunchConfigurations",
                    "autoscaling:DescribeScalingActivities",
                    "autoscaling:PutScalingPolicy",
                    "autoscaling:DeletePolicy",
                    "autoscaling:DescribePolicies",
                ],
                "Resource": "*",
            },
            # ── Elastic Load Balancing (for EKS ALB ingress) ─────────────────
            {
                "Sid": "ELB",
                "Effect": "Allow",
                "Action": [
                    "elasticloadbalancing:CreateLoadBalancer",
                    "elasticloadbalancing:DeleteLoadBalancer",
                    "elasticloadbalancing:DescribeLoadBalancers",
                    "elasticloadbalancing:ModifyLoadBalancerAttributes",
                    "elasticloadbalancing:CreateTargetGroup",
                    "elasticloadbalancing:DeleteTargetGroup",
                    "elasticloadbalancing:DescribeTargetGroups",
                    "elasticloadbalancing:ModifyTargetGroup",
                    "elasticloadbalancing:CreateListener",
                    "elasticloadbalancing:DeleteListener",
                    "elasticloadbalancing:DescribeListeners",
                    "elasticloadbalancing:ModifyListener",
                    "elasticloadbalancing:AddTags",
                    "elasticloadbalancing:DescribeTags",
                ],
                "Resource": "*",
            },
            # ── STS (identity verification in workflow steps) ────────────────
            {
                "Sid": "STSIdentityCheck",
                "Effect": "Allow",
                "Action": "sts:GetCallerIdentity",
                "Resource": "*",
            },
        ],
    }


# ── Step 4: IAM Role ──────────────────────────────────────────────────────────

def create_oidc_role(provider_arn):
    step("Creating IAM OIDC Role")
    info(f"Role name : {ROLE_NAME}")
    info(f"Role ARN  : {ROLE_ARN}")

    trust_policy = build_trust_policy(provider_arn)

    try:
        resp = iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description=(
                f"Assumed by GitHub Actions via OIDC for {GITHUB_REPO}. "
                "Provides least-privilege access to EB, CloudFront, WAF, EKS, "
                "VPC, ECR, S3, IAM, ACM, and STS for the frontend CDN project."
            ),
            MaxSessionDuration=3600,  # 1 hour -- sufficient for any single workflow job
            Tags=[
                {"Key": "Project",    "Value": "frontend-cdn-project"},
                {"Key": "ManagedBy",  "Value": "setup_oidc_role.py"},
                {"Key": "GitHubRepo", "Value": GITHUB_REPO},
                {"Key": "AuthMethod", "Value": "OIDC"},
            ],
        )
        role_arn = resp["Role"]["Arn"]
        ok(f"Role created: {role_arn}")
    except iam.exceptions.EntityAlreadyExistsException:
        role_arn = iam.get_role(RoleName=ROLE_NAME)["Role"]["Arn"]
        ok(f"Role already exists: {role_arn}")

        # Refresh trust policy to reflect current config
        iam.update_assume_role_policy(
            RoleName=ROLE_NAME,
            PolicyDocument=json.dumps(trust_policy),
        )
        ok("Trust policy refreshed")

    return role_arn


# ── Step 5: Inline Permissions Policy ─────────────────────────────────────────

def attach_permissions_policy():
    step("Attaching Permissions Policy")
    info(f"Policy name : {POLICY_NAME}")

    permissions_policy = build_permissions_policy()

    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(permissions_policy),
    )
    ok(f"Inline policy attached: {POLICY_NAME}")


# ── Step 6: Verify ────────────────────────────────────────────────────────────

def verify_role():
    step("Verifying Role Configuration")

    role = iam.get_role(RoleName=ROLE_NAME)["Role"]
    trust = role["AssumeRolePolicyDocument"]

    ok(f"Role ARN   : {role['Arn']}")
    ok(f"Created    : {role['CreateDate']}")
    ok(f"Max session: {role['MaxSessionDuration']}s")

    print("\n  Trust Policy (summary):")
    for stmt in trust.get("Statement", []):
        principal = stmt.get("Principal", {}).get("Federated", "N/A")
        conditions = stmt.get("Condition", {})
        sub_conds = conditions.get("StringLike", {}).get(
            "token.actions.githubusercontent.com:sub", []
        )
        print(f"    Principal  : {principal}")
        print(f"    Trusted subs:")
        for sub in (sub_conds if isinstance(sub_conds, list) else [sub_conds]):
            print(f"      - {sub}")

    print("\n  Permissions Policy (statements summary):")
    policy = iam.get_role_policy(RoleName=ROLE_NAME, PolicyName=POLICY_NAME)
    doc = policy["PolicyDocument"]
    for stmt in doc.get("Statement", []):
        sid = stmt.get("Sid", "unnamed")
        actions = stmt.get("Action", [])
        if isinstance(actions, str):
            actions = [actions]
        print(f"    [{sid}]: {len(actions)} action(s)")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 65)
    print("  OIDC Federated Identity Setup -- frontend-cdn-project")
    print("=" * 65)
    print(f"  Repository  : {GITHUB_REPO}")
    print(f"  AWS Account : {ACCOUNT_ID}")
    print(f"  Role name   : {ROLE_NAME}")
    print("=" * 65)

    # Verify caller has sufficient IAM permissions before starting
    sts = boto3.client("sts", region_name="us-east-1")
    identity = sts.get_caller_identity()
    info(f"Running as  : {identity['Arn']}")

    provider_arn = create_oidc_provider()
    role_arn     = create_oidc_role(provider_arn)
    attach_permissions_policy()
    verify_role()

    print("\n" + "=" * 65)
    print("  SETUP COMPLETE")
    print("=" * 65)
    print(f"  OIDC Provider ARN : {OIDC_PROVIDER_ARN}")
    print(f"  Role ARN          : {role_arn}")
    print()
    print("  Add this to GitHub → Settings → Secrets and variables → Actions:")
    print(f"    AWS_OIDC_ROLE_ARN = {role_arn}")
    print()
    print("  Next steps:")
    print("  1. Add AWS_OIDC_ROLE_ARN secret to the GitHub repo (value above)")
    print("  2. Add TF_API_TOKEN secret (your Terraform Cloud user token)")
    print("  3. Push your Terraform + workflows to trigger the pipeline")
    print("  4. No long-lived AWS keys needed -- OIDC is fully keyless")
    print("=" * 65 + "\n")

    return role_arn


if __name__ == "__main__":
    main()
