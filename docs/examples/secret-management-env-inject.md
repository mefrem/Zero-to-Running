# CI/CD Environment Variable Injection

This guide shows how to manage secrets using CI/CD platform environment variables for simple deployments.

## Overview

CI/CD environment injection is a straightforward approach to secret management that:

- **Stores secrets in CI/CD platform** (GitHub Actions, GitLab CI, Jenkins, etc.)
- **Injects as environment variables** at build or deployment time
- **No additional infrastructure** required
- **Best for**: Small to medium applications, Docker-based deployments

**Pros:**

- Simple to implement
- No additional infrastructure
- Integrated with existing CI/CD
- Free with most CI/CD platforms

**Cons:**

- No automatic rotation
- Limited audit logging
- Secrets tied to CI/CD platform
- Manual rotation process

---

## GitHub Actions

### Step 1: Store Secrets in GitHub

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add secrets:
   - `DATABASE_PASSWORD`
   - `REDIS_PASSWORD`
   - `SESSION_SECRET`
   - `JWT_SECRET`

### Step 2: Reference Secrets in Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  # Non-sensitive environment variables
  NODE_ENV: production
  DATABASE_HOST: db.production.example.com
  DATABASE_NAME: zero_to_running
  REDIS_HOST: redis.production.example.com

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          docker build -t zero-to-running:${{ github.sha }} ./backend

      - name: Deploy to server
        env:
          # Inject secrets as environment variables
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
          REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: |
          # Deploy using docker-compose
          scp docker-compose.prod.yml user@server:/app/
          ssh user@server "cd /app && \
            export DATABASE_PASSWORD='$DATABASE_PASSWORD' && \
            export REDIS_PASSWORD='$REDIS_PASSWORD' && \
            export SESSION_SECRET='$SESSION_SECRET' && \
            export JWT_SECRET='$JWT_SECRET' && \
            docker-compose -f docker-compose.prod.yml up -d"
```

### Step 3: Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  backend:
    image: zero-to-running:latest
    environment:
      NODE_ENV: production
      PORT: 3001

      # Database config
      DATABASE_HOST: ${DATABASE_HOST}
      DATABASE_PORT: 5432
      DATABASE_NAME: ${DATABASE_NAME}
      DATABASE_USER: postgres
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}

      # Redis config
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}

      # Security
      SESSION_SECRET: ${SESSION_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"
    restart: unless-stopped
```

---

## GitLab CI/CD

### Step 1: Store Secrets in GitLab

1. Go to **Settings** → **CI/CD** → **Variables**
2. Add variables:
   - `DATABASE_PASSWORD` (Type: Variable, Protected: Yes, Masked: Yes)
   - `REDIS_PASSWORD` (Type: Variable, Protected: Yes, Masked: Yes)
   - `SESSION_SECRET` (Type: Variable, Protected: Yes, Masked: Yes)
   - `JWT_SECRET` (Type: Variable, Protected: Yes, Masked: Yes)

### Step 2: Reference in .gitlab-ci.yml

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - deploy

variables:
  NODE_ENV: production
  DATABASE_HOST: db.production.example.com
  REDIS_HOST: redis.production.example.com

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA ./backend
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:production:
  stage: deploy
  image: alpine:latest
  only:
    - main
  environment:
    name: production
    url: https://api.example.com
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
  script:
    - |
      ssh user@production-server << EOF
        export DATABASE_PASSWORD='$DATABASE_PASSWORD'
        export REDIS_PASSWORD='$REDIS_PASSWORD'
        export SESSION_SECRET='$SESSION_SECRET'
        export JWT_SECRET='$JWT_SECRET'
        cd /app
        docker-compose pull
        docker-compose up -d
      EOF
```

---

## Jenkins

### Step 1: Store Secrets in Jenkins

1. Go to **Manage Jenkins** → **Credentials**
2. Add credentials:
   - Kind: Secret text
   - Secret: `<generated-password>`
   - ID: `database-password`
   - Description: Database Password

Repeat for all secrets.

### Step 2: Reference in Jenkinsfile

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        DATABASE_HOST = 'db.production.example.com'
        REDIS_HOST = 'redis.production.example.com'
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker build -t zero-to-running:${BUILD_NUMBER} ./backend'
            }
        }

        stage('Deploy') {
            environment {
                // Load secrets from Jenkins credentials
                DATABASE_PASSWORD = credentials('database-password')
                REDIS_PASSWORD = credentials('redis-password')
                SESSION_SECRET = credentials('session-secret')
                JWT_SECRET = credentials('jwt-secret')
            }
            steps {
                sh '''
                    ssh user@production << EOF
                    export DATABASE_PASSWORD='${DATABASE_PASSWORD}'
                    export REDIS_PASSWORD='${REDIS_PASSWORD}'
                    export SESSION_SECRET='${SESSION_SECRET}'
                    export JWT_SECRET='${JWT_SECRET}'
                    cd /app
                    docker-compose up -d
                    EOF
                '''
            }
        }
    }
}
```

---

## CircleCI

### Step 1: Store Secrets in CircleCI

1. Go to **Project Settings** → **Environment Variables**
2. Add variables:
   - `DATABASE_PASSWORD`
   - `REDIS_PASSWORD`
   - `SESSION_SECRET`
   - `JWT_SECRET`

### Step 2: Reference in .circleci/config.yml

Create `.circleci/config.yml`:

```yaml
version: 2.1

executors:
  docker-executor:
    docker:
      - image: cimg/node:20.0

jobs:
  build:
    executor: docker-executor
    steps:
      - checkout
      - setup_remote_docker
      - run:
          name: Build Docker image
          command: |
            docker build -t zero-to-running:${CIRCLE_SHA1} ./backend
            docker push zero-to-running:${CIRCLE_SHA1}

  deploy:
    executor: docker-executor
    steps:
      - run:
          name: Deploy to production
          command: |
            ssh user@production << EOF
            export NODE_ENV=production
            export DATABASE_HOST=db.production.example.com
            export DATABASE_PASSWORD='${DATABASE_PASSWORD}'
            export REDIS_HOST=redis.production.example.com
            export REDIS_PASSWORD='${REDIS_PASSWORD}'
            export SESSION_SECRET='${SESSION_SECRET}'
            export JWT_SECRET='${JWT_SECRET}'
            cd /app
            docker-compose pull
            docker-compose up -d
            EOF

workflows:
  build-and-deploy:
    jobs:
      - build
      - deploy:
          requires:
            - build
          filters:
            branches:
              only: main
```

---

## Docker-Based Deployment

### Method 1: Environment File on Server

Create `.env.production` on the server:

```bash
NODE_ENV=production
DATABASE_HOST=db.production.example.com
DATABASE_PASSWORD=<actual-password>
REDIS_HOST=redis.production.example.com
REDIS_PASSWORD=<actual-password>
SESSION_SECRET=<actual-secret>
JWT_SECRET=<actual-secret>
```

**IMPORTANT:** Never commit this file to version control!

Use in docker-compose:

```yaml
services:
  backend:
    env_file: .env.production
```

### Method 2: Pass at Runtime

```bash
# Deploy with environment variables
docker run -d \
  -e NODE_ENV=production \
  -e DATABASE_HOST=db.production.example.com \
  -e DATABASE_PASSWORD="$DATABASE_PASSWORD" \
  -e REDIS_PASSWORD="$REDIS_PASSWORD" \
  -e SESSION_SECRET="$SESSION_SECRET" \
  -e JWT_SECRET="$JWT_SECRET" \
  zero-to-running:latest
```

---

## Secret Rotation Process

Since CI/CD injection doesn't support automatic rotation, implement manual rotation:

### Step 1: Generate New Secret

```bash
openssl rand -base64 32
```

### Step 2: Update CI/CD Platform

1. Navigate to secrets/variables section
2. Edit the secret value
3. Save the updated value

### Step 3: Trigger Redeployment

```bash
# Manually trigger deployment
git commit --allow-empty -m "Rotate secrets"
git push
```

Or trigger via API:

```bash
# GitHub Actions
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/dispatches \
  -d '{"ref":"main"}'
```

---

## Security Best Practices

### ✓ Do

- Mark secrets as "Protected" and "Masked" in CI/CD platform
- Use separate secrets for each environment (dev, staging, prod)
- Rotate secrets on a regular schedule (every 90 days)
- Limit access to secret management in CI/CD platform
- Use SSH keys or deploy tokens for deployment
- Audit secret access regularly
- Never log secret values in CI/CD output

### ✗ Don't

- Commit secrets to version control
- Use same secrets across environments
- Share secrets via chat or email
- Grant broad access to CI/CD secrets
- Print secrets in CI/CD logs
- Use weak or predictable secrets
- Skip secret rotation

---

## Monitoring and Auditing

### GitHub Actions

View workflow runs and audit logs:

```bash
# Using GitHub CLI
gh run list --workflow=deploy.yml
gh run view <run-id> --log
```

Audit log available in GitHub Enterprise:

- **Settings** → **Security** → **Audit log**

### GitLab CI/CD

View pipeline history:

- **CI/CD** → **Pipelines**
- Click pipeline to view logs

Audit events:

- **Settings** → **Audit Events**

### Jenkins

View build history:

- Job → **Build History**
- Click build number → **Console Output**

---

## Troubleshooting

### Secrets Not Being Injected

**Cause:** Environment variable not passed correctly

**Solution:**

1. Check secret name matches in CI/CD platform
2. Verify secret is available in environment scope
3. Test with a dummy echo (don't log actual secrets):

   ```bash
   echo "Database password is set: ${DATABASE_PASSWORD:+YES}"
   ```

### Application Can't Connect

**Cause:** Secret value incorrect or has extra characters

**Solution:**

1. Verify secret value in CI/CD platform (check for trailing newlines)
2. Test secret locally:

   ```bash
   export DATABASE_PASSWORD='<value-from-cicd>'
   make test-connection
   ```

### Secrets Appearing in Logs

**Cause:** Secrets not marked as "Masked" or accidentally echoed

**Solution:**

1. Mark secrets as "Masked" in CI/CD platform
2. Never echo secrets in scripts
3. Use sanitized logging in application

---

## Migration to Advanced Secret Management

When your application outgrows CI/CD environment injection, migrate to:

1. **AWS Secrets Manager** - For AWS deployments
2. **HashiCorp Vault** - For multi-cloud or on-premises
3. **Kubernetes Secrets** - For Kubernetes deployments

Migration steps:

1. Set up new secret management system
2. Store secrets in new system
3. Update application to fetch from new system
4. Test in staging environment
5. Deploy to production
6. Remove old secrets from CI/CD platform

---

## Cost Considerations

CI/CD environment injection is typically **free**:

- GitHub Actions: Free tier includes 2,000 minutes/month
- GitLab CI: Free tier includes 400 minutes/month
- CircleCI: Free tier includes 6,000 build minutes/month
- Jenkins: Self-hosted (infrastructure cost only)

**Total cost: $0 (within free tier limits)**

---

## References

- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitLab CI Variables](https://docs.gitlab.com/ee/ci/variables/)
- [Jenkins Credentials](https://www.jenkins.io/doc/book/using/using-credentials/)
- [CircleCI Environment Variables](https://circleci.com/docs/env-vars/)
- [12-Factor App: Config](https://12factor.net/config)
