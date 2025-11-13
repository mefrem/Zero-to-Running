<!-- 7f72a28a-5a00-43c9-9d03-dd304527d3a7 2b599e60-d235-4591-a218-cf0f711e6585 -->
# AWS Fargate Deployment Plan

## Overview

Introduce an `aws` deployment profile that builds and publishes the Zero-to-Running stack on AWS using Terraform-managed ECS Fargate services. All work will happen in a new git worktree to keep the current demo-ready repo untouched.

## Proposed Worktree

- Create a sibling worktree (e.g. `deploy-fargate`) from `main`
- Perform all changes, testing, and commits inside the worktree
- Merge back only after verification

## Steps

1. **Worktree Setup**  

- `git worktree add ../deploy-fargate main`
- Verify clean status and switch to the worktree before editing

2. **Terraform Bootstrap**  

- Add `infra/terraform` with backend configuration (S3 + DynamoDB), providers, and variable definitions  
- Modules/resources for VPC, subnets, security groups, ECS cluster, Fargate services (frontend/back) with ALB + target groups + listeners  
- Define IAM roles/policies for task execution and logging  
- Outputs for service endpoints and DNS targets

3. **Docker & Build Pipeline**  

- Add production Dockerfiles if needed (`backend/Dockerfile.prod`, `frontend/Dockerfile.prod`) or adapt current ones to support multi-stage builds  
- Create ECR repositories and Terraform resources; wire tasks to the latest image tags  
- Add scripts/Make targets (`make package`, `make push-images`) to build/push images to ECR before deploy

4. **Deploy Orchestration**  

- New `make deploy` target: builds images, pushes to ECR, runs `terraform init/plan/apply` with environment selection  
- Handle secrets via SSM Parameter Store or Secrets Manager referenced by task definitions  
- Define rollback instructions (`make destroy` for test envs)

5. **Documentation & Verification**  

- Update `README.md`/`docs/DEPLOYMENT.md` with prerequisites (AWS CLI creds, Terraform state bucket), detailed deploy steps, and cleanup guidance  
- Document worktree usage and how to merge deployment branch later  
- Run Terraform plan in a sandbox account (no apply) to validate graph; capture outputs for docs

## Optional Enhancements

- Add CI workflow (GitHub Actions) to lint Terraform and run `terraform plan` on PRs  
- Configure Route 53 DNS or CloudFront if custom domains are needed down the line

### To-dos

- [ ] Normalize tracked env files to defaults and describe override workflow