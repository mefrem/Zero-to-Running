# Secret Management Guide

## Table of Contents

- [Overview](#overview)
- [Mock Secrets in Development](#mock-secrets-in-development)
- [Secret Management Principles](#secret-management-principles)
- [Local Development Setup](#local-development-setup)
- [Production Secret Management](#production-secret-management)
- [Secret Rotation](#secret-rotation)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

This guide explains how Zero-to-Running handles secrets across different environments, from local development with mock secrets to production deployments with enterprise secret management systems.

### What Are Secrets?

Secrets are sensitive configuration values that should never be committed to version control:

- **Database passwords** - Credentials for database access
- **API keys** - Third-party service authentication tokens
- **JWT secrets** - Signing keys for JSON Web Tokens
- **Session secrets** - Encryption keys for session data
- **Redis passwords** - Cache authentication credentials
- **Encryption keys** - Data encryption/decryption keys

### Why This Matters

Proper secret management is critical for:

- **Security**: Preventing unauthorized access to systems and data
- **Compliance**: Meeting regulatory requirements (GDPR, HIPAA, PCI-DSS)
- **Auditability**: Tracking secret access and changes
- **Operability**: Managing secrets across environments without manual intervention

---

## Mock Secrets in Development

Zero-to-Running uses a **mock secret pattern** for local development that teaches production-ready practices while remaining safe and convenient for developers.

### What Are Mock Secrets?

Mock secrets are development-only values prefixed with `CHANGE_ME_` that:

- ✓ Are safe to commit in `.env.example` (but NOT in `.env`)
- ✓ Work out-of-the-box for local development
- ✓ Trigger warnings when detected at runtime
- ✓ Teach the pattern of environment-based secrets
- ✗ Should NEVER be used in production

### Example Mock Secrets

From `.env.example`:

```bash
# ⚠️ MOCK SECRET - FOR DEVELOPMENT ONLY
DATABASE_PASSWORD=CHANGE_ME_postgres_123

# ⚠️ MOCK SECRET - FOR DEVELOPMENT ONLY
REDIS_PASSWORD=CHANGE_ME_redis_123

# ⚠️ MOCK SECRET - FOR DEVELOPMENT ONLY
SESSION_SECRET=CHANGE_ME_session_secret_32_character_minimum

# ⚠️ MOCK SECRET - FOR DEVELOPMENT ONLY
JWT_SECRET=CHANGE_ME_jwt_secret_32_character_minimum
```

### Mock Secret Detection

When the application starts with mock secrets, you'll see a warning like:

```
================================================================================
⚠️  WARNING: Mock secrets detected in use (development only!)
================================================================================

The following mock secrets are currently configured:
  • DATABASE_PASSWORD (set to: CHANGE_ME_postgres_123)
  • REDIS_PASSWORD (set to: CHANGE_ME_redis_123)
  • SESSION_SECRET (set to: CHANGE_ME_session_sec...)
  • JWT_SECRET (set to: CHANGE_ME_jwt_secret...)

These are safe for local development, but should NEVER be used in production.

For production deployment, see: /docs/SECRET_MANAGEMENT.md
Generate strong secrets with: openssl rand -base64 32
================================================================================
```

This warning is **intentional and expected** in local development. It:

- Does NOT prevent the application from starting
- Reminds developers these are temporary development values
- Provides guidance on generating real secrets
- Reinforces the practice of environment-based configuration

---

## Secret Management Principles

### 1. Never Hardcode Secrets

**Bad:**

```typescript
// ❌ NEVER DO THIS
const dbPassword = 'my-secret-password';
const apiKey = 'sk_live_abc123xyz789';
```

**Good:**

```typescript
// ✓ Load from environment
const dbPassword = process.env.DATABASE_PASSWORD;
const apiKey = process.env.API_KEY;
```

### 2. Never Commit Secrets to Version Control

**Safeguards in This Project:**

- `.env` is git-ignored (real secrets go here)
- `.env.example` contains mock secrets only
- Validation warns on mock secret detection
- Documentation explains the pattern

### 3. Use Environment-Specific Secrets

Each environment should have **unique secrets**:

| Environment | Secret Source                  | Example                     |
|-------------|--------------------------------|-----------------------------|
| Development | `.env` file (mock secrets OK)  | `CHANGE_ME_postgres_123`    |
| Staging     | Secret manager or CI/CD        | Unique staging password     |
| Production  | Secret manager (AWS, Vault)    | Unique production password  |

### 4. Principle of Least Privilege

Grant secrets the **minimum necessary permissions**:

- Database user should only access required databases
- API keys should have minimal scopes
- Service accounts should have restricted IAM roles

### 5. Rotate Secrets Regularly

- Establish rotation schedules (e.g., every 90 days)
- Use automated rotation when possible
- Have a process for emergency rotation after incidents

---

## Local Development Setup

### Step 1: Create Your `.env` File

```bash
# Copy the example file
cp .env.example .env
```

### Step 2: Customize Secrets (Optional)

For local development, you can:

**Option A:** Keep mock secrets (easiest)

```bash
# Leave mock secrets as-is in .env
DATABASE_PASSWORD=CHANGE_ME_postgres_123
SESSION_SECRET=CHANGE_ME_session_secret_32_character_minimum
```

**Option B:** Generate real secrets for local testing

```bash
# Generate a strong password
DATABASE_PASSWORD=$(openssl rand -base64 24)

# Generate a strong secret (32+ characters)
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
```

### Step 3: Start the Application

```bash
make up
```

You'll see the mock secret warning if using `CHANGE_ME_` values. This is expected and safe for development.

### Step 4: Verify Configuration

```bash
make config
```

This validates your `.env` file and shows which mock secrets are in use.

---

## Production Secret Management

In production, **never use mock secrets**. Choose a secret management approach based on your deployment platform.

### Option 1: AWS Secrets Manager

**Best for:** AWS deployments, full secret lifecycle management

See: [AWS Secrets Manager Integration Example](./examples/secret-management-aws.md)

**Features:**

- Automatic secret rotation
- Audit logging via CloudTrail
- Fine-grained IAM access control
- Encryption at rest and in transit
- Integration with RDS, ECS, Lambda

### Option 2: HashiCorp Vault

**Best for:** Multi-cloud, on-premises, or hybrid deployments

See: [HashiCorp Vault Integration Example](./examples/secret-management-vault.md)

**Features:**

- Dynamic secrets generation
- Secret leasing and renewal
- Detailed audit logs
- Multi-cloud support
- Key/value and database secret engines

### Option 3: Kubernetes Secrets

**Best for:** Kubernetes deployments

See: [Kubernetes Secrets Integration Example](./examples/secret-management-kubernetes.md)

**Features:**

- Native Kubernetes integration
- RBAC access control
- Base64 encoding (not encryption by default)
- Pod-level secret injection
- External Secrets Operator for cloud integration

### Option 4: CI/CD Environment Injection

**Best for:** Simple deployments, Docker-based hosting

See: [CI/CD Environment Injection Example](./examples/secret-management-env-inject.md)

**Features:**

- Secrets stored in CI/CD platform (GitHub Actions, GitLab CI)
- Injected as environment variables at runtime
- No additional infrastructure required
- Suitable for small to medium applications

---

## Database and Redis Credential Handling

### Why Environment Variables?

Zero-to-Running passes database and Redis credentials via **individual environment variables**, not connection string literals.

**Good Pattern (Individual Variables):**

```typescript
const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD, // ✓ Environment variable
};
```

**Bad Pattern (Hardcoded Connection String):**

```typescript
// ❌ NEVER DO THIS
const connectionString = 'postgresql://user:password123@localhost:5432/mydb';
```

### Benefits of This Approach

1. **Flexibility**: Change credentials without code changes
2. **Security**: Passwords never appear in source code
3. **Environment-Specific**: Different credentials per environment
4. **Auditability**: Credential usage tracked via logging
5. **Rotation**: Update password without redeployment

### Connection String Construction

The application constructs connection strings **at runtime** from environment variables:

**PostgreSQL:**

```typescript
// Constructed from environment variables
const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
```

**Redis:**

```typescript
// Constructed from environment variables
const redisUrl = password
  ? `redis://:${password}@${host}:${port}/${db}`
  : `redis://${host}:${port}/${db}`;
```

### Credential Masking in Logs

All connection strings are **sanitized before logging**:

```typescript
// Before logging
postgresql://postgres:MySecretPass123@localhost:5432/mydb

// After sanitization
postgresql://postgres:****@localhost:5432/mydb
```

This ensures passwords never appear in application logs or error messages.

---

## Secret Rotation

### Why Rotate Secrets?

- Limit exposure window if secret is compromised
- Comply with security policies and regulations
- Reduce risk from former employees or contractors
- Demonstrate security diligence for audits

### Rotation Schedule

| Secret Type       | Recommended Rotation | Priority |
|-------------------|----------------------|----------|
| Database Password | Every 90 days        | High     |
| API Keys          | Every 90 days        | High     |
| JWT Secret        | Every 180 days       | Medium   |
| Session Secret    | Every 180 days       | Medium   |
| Encryption Keys   | Every 365 days       | Medium   |

### Manual Rotation Process

1. **Generate new secret:**

   ```bash
   NEW_SECRET=$(openssl rand -base64 32)
   ```

2. **Update secret in secret manager:**

   ```bash
   # AWS Secrets Manager example
   aws secretsmanager update-secret \
     --secret-id production/database/password \
     --secret-string "$NEW_SECRET"
   ```

3. **Restart application to pick up new value**
4. **Verify application health**
5. **Document rotation in audit log**

### Automated Rotation

**AWS Secrets Manager** supports automatic rotation:

- Lambda function triggered on schedule
- Updates secret and database password
- Zero-downtime rotation supported

**HashiCorp Vault** supports dynamic secrets:

- Generates credentials on-demand
- Automatically revokes after lease expires
- No manual rotation needed

---

## Troubleshooting

### Mock Secret Warnings Appearing

**Symptom:** You see the mock secret warning banner when starting the application.

**Cause:** One or more secrets in your `.env` file start with `CHANGE_ME_`.

**Solution:**

- **For development:** This is expected and safe. Ignore the warning.
- **For production:** Generate real secrets and replace all `CHANGE_ME_` values:

  ```bash
  # Generate strong secrets
  openssl rand -base64 32

  # Update .env
  DATABASE_PASSWORD=<generated-value>
  SESSION_SECRET=<generated-value>
  JWT_SECRET=<generated-value>
  ```

### Configuration Validation Fails

**Symptom:** Application fails to start with "Configuration validation failed".

**Cause:** A required secret is missing or invalid.

**Solution:**

1. Check which secret is failing:

   ```bash
   make config
   ```

2. Ensure the secret is set in `.env`:

   ```bash
   grep "DATABASE_PASSWORD" .env
   ```

3. Verify the secret meets requirements (length, format)

### Secrets Not Loading

**Symptom:** Application can't connect to database or services due to authentication errors.

**Cause:** Environment variables not loaded correctly.

**Solution:**

1. Verify `.env` file exists:

   ```bash
   ls -la .env
   ```

2. Check environment variables are set:

   ```bash
   docker-compose exec backend env | grep DATABASE_PASSWORD
   ```

3. Restart services to reload environment:

   ```bash
   make restart
   ```

### Credentials Appear in Logs

**Symptom:** You see actual passwords in application logs.

**Cause:** Logging is not properly sanitizing sensitive data.

**Solution:**

- This should not happen in Zero-to-Running (credential masking is built-in)
- If you see this, it's a bug - please report it
- Check `backend/src/utils/logger.ts` for sanitization logic

---

## Best Practices

### ✓ Do

- Use environment variables for all secrets
- Keep `.env` file out of version control (it's git-ignored)
- Use mock secrets (`CHANGE_ME_` prefix) in `.env.example`
- Generate unique secrets for each environment
- Rotate secrets on a regular schedule
- Use a secret manager in production (AWS, Vault, etc.)
- Grant minimum necessary permissions
- Monitor secret access with audit logs
- Document secret rotation procedures
- Test secret rotation in staging before production

### ✗ Don't

- Hardcode secrets in source code
- Commit `.env` file to version control
- Use the same secrets across environments
- Share secrets via email or chat
- Use weak or default passwords
- Skip secret rotation
- Grant overly broad permissions
- Log actual secret values
- Use mock secrets in production
- Copy production secrets to development

---

## Additional Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)

---

## Quick Reference

### Generate Strong Secrets

```bash
# Generate a 32-character base64 secret
openssl rand -base64 32

# Generate a 64-character hexadecimal secret
openssl rand -hex 64

# Generate a UUID (for API keys)
uuidgen
```

### Check Current Mock Secrets

```bash
# Run validation script
make config

# Or check manually
grep "CHANGE_ME_" .env
```

### Update a Secret in Production

1. Generate new value: `openssl rand -base64 32`
2. Update secret manager (AWS, Vault, K8s)
3. Restart application
4. Verify connectivity
5. Document in change log

---

For integration examples with specific platforms, see:

- [AWS Secrets Manager Integration](./examples/secret-management-aws.md)
- [HashiCorp Vault Integration](./examples/secret-management-vault.md)
- [Kubernetes Secrets Integration](./examples/secret-management-kubernetes.md)
- [CI/CD Environment Injection](./examples/secret-management-env-inject.md)
