# HashiCorp Vault Integration

This guide shows how to integrate Zero-to-Running with HashiCorp Vault for production secret management.

## Overview

HashiCorp Vault is a secrets management solution that provides:

- **Dynamic secrets** - Generate secrets on-demand
- **Secret leasing** - Automatic expiration and renewal
- **Multiple secret backends** - KV, database, AWS, PKI, etc.
- **Fine-grained access control** - Policy-based permissions
- **Audit logging** - Detailed logs of all secret access
- **Multi-cloud support** - Works across AWS, Azure, GCP, on-premises

---

## Prerequisites

- Vault server deployed and initialized
- Vault CLI installed
- Application server with network access to Vault
- Vault authentication configured (AppRole, Kubernetes, AWS IAM, etc.)

---

## Step 1: Enable KV Secrets Engine

```bash
# Enable KV v2 secrets engine
vault secrets enable -path=secret kv-v2

# Verify enabled
vault secrets list
```

---

## Step 2: Store Secrets in Vault

```bash
# Store database password
vault kv put secret/production/zero-to-running/database \
  password="$(openssl rand -base64 32)" \
  username="postgres" \
  host="db.example.com" \
  port="5432" \
  database="zero_to_running"

# Store Redis password
vault kv put secret/production/zero-to-running/redis \
  password="$(openssl rand -base64 32)" \
  host="redis.example.com" \
  port="6379"

# Store session secret
vault kv put secret/production/zero-to-running/session \
  secret="$(openssl rand -base64 32)"

# Store JWT secret
vault kv put secret/production/zero-to-running/jwt \
  secret="$(openssl rand -base64 32)"

# Verify secrets stored
vault kv get secret/production/zero-to-running/database
```

---

## Step 3: Create Vault Policy

Create a policy file `zero-to-running-policy.hcl`:

```hcl
# Policy for Zero-to-Running application
path "secret/data/production/zero-to-running/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/production/zero-to-running/*" {
  capabilities = ["list"]
}
```

Apply the policy:

```bash
vault policy write zero-to-running zero-to-running-policy.hcl
```

---

## Step 4: Configure AppRole Authentication

```bash
# Enable AppRole auth method
vault auth enable approle

# Create role for the application
vault write auth/approle/role/zero-to-running \
  token_policies="zero-to-running" \
  token_ttl=1h \
  token_max_ttl=24h \
  secret_id_ttl=0

# Get role ID
vault read auth/approle/role/zero-to-running/role-id

# Generate secret ID
vault write -f auth/approle/role/zero-to-running/secret-id
```

Save the `role_id` and `secret_id` for Step 7.

---

## Step 5: Install Vault Client

Add Vault client to backend dependencies:

```bash
cd backend
npm install node-vault
```

---

## Step 6: Create Vault Integration Module

Create `/backend/src/config/vault-secrets.ts`:

```typescript
/**
 * HashiCorp Vault Integration
 * Loads secrets from Vault in production environments
 */

import vault from 'node-vault';
import { logger } from '../utils/logger';

// Initialize Vault client
const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
});

/**
 * Authenticate with Vault using AppRole
 */
async function authenticateWithVault(): Promise<string> {
  try {
    const roleId = process.env.VAULT_ROLE_ID;
    const secretId = process.env.VAULT_SECRET_ID;

    if (!roleId || !secretId) {
      throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID must be set');
    }

    const response = await vaultClient.approleLogin({
      role_id: roleId,
      secret_id: secretId,
    });

    const token = response.auth.client_token;
    vaultClient.token = token;

    logger.info({
      msg: 'Successfully authenticated with Vault',
      tokenTTL: response.auth.lease_duration,
    });

    return token;
  } catch (error) {
    logger.error({
      msg: 'Failed to authenticate with Vault',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Retrieve a secret from Vault KV v2
 */
async function getSecret(path: string): Promise<Record<string, any>> {
  try {
    const response = await vaultClient.read(`secret/data/${path}`);
    return response.data.data;
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve secret from Vault',
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Load all application secrets from Vault
 */
export async function loadSecretsFromVault(): Promise<{
  databasePassword: string;
  databaseConfig: any;
  redisPassword?: string;
  sessionSecret: string;
  jwtSecret?: string;
}> {
  const environment = process.env.NODE_ENV || 'production';
  const secretPrefix = `${environment}/zero-to-running`;

  logger.info({
    msg: 'Loading secrets from Vault',
    environment,
    vaultAddr: process.env.VAULT_ADDR,
  });

  try {
    // Authenticate first
    await authenticateWithVault();

    // Load all secrets in parallel
    const [dbSecret, redisSecret, sessionSecretData, jwtSecretData] =
      await Promise.all([
        getSecret(`${secretPrefix}/database`),
        getSecret(`${secretPrefix}/redis`).catch(() => null),
        getSecret(`${secretPrefix}/session`),
        getSecret(`${secretPrefix}/jwt`).catch(() => null),
      ]);

    logger.info({
      msg: 'Successfully loaded secrets from Vault',
      loadedSecrets: [
        'database',
        redisSecret ? 'redis' : null,
        'session',
        jwtSecretData ? 'jwt' : null,
      ].filter(Boolean),
    });

    return {
      databasePassword: dbSecret.password,
      databaseConfig: dbSecret,
      redisPassword: redisSecret?.password,
      sessionSecret: sessionSecretData.secret,
      jwtSecret: jwtSecretData?.secret,
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to load secrets from Vault',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Renew Vault token periodically
 */
export function startTokenRenewal(): NodeJS.Timeout {
  const renewalInterval = 30 * 60 * 1000; // Renew every 30 minutes

  return setInterval(async () => {
    try {
      await vaultClient.tokenRenewSelf();
      logger.info({ msg: 'Successfully renewed Vault token' });
    } catch (error) {
      logger.error({
        msg: 'Failed to renew Vault token',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, renewalInterval);
}
```

---

## Step 7: Configure Environment Variables

```bash
# Vault server address
VAULT_ADDR=https://vault.example.com:8200

# AppRole credentials (from Step 4)
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id

# Enable Vault integration
USE_VAULT_SECRETS=true

# Optional: Skip TLS verification (development only!)
# VAULT_SKIP_VERIFY=true
```

---

## Step 8: Update Application Configuration

Modify `/backend/src/config/env.ts`:

```typescript
import { loadSecretsFromVault } from './vault-secrets';

export async function loadConfigWithSecrets(): Promise<AppConfig> {
  let secrets;

  // Load secrets from Vault in production
  if (process.env.USE_VAULT_SECRETS === 'true') {
    secrets = await loadSecretsFromVault();
  }

  const config: AppConfig = {
    database: {
      host: secrets?.databaseConfig?.host || process.env.DATABASE_HOST,
      port: parseInt(secrets?.databaseConfig?.port || process.env.DATABASE_PORT || '5432'),
      name: secrets?.databaseConfig?.database || process.env.DATABASE_NAME,
      user: secrets?.databaseConfig?.username || process.env.DATABASE_USER,
      password: secrets?.databasePassword || getRequiredEnv('DATABASE_PASSWORD'),
      poolMin: getIntEnv('DATABASE_POOL_MIN', 2),
      poolMax: getIntEnv('DATABASE_POOL_MAX', 10),
    },

    redis: {
      password: secrets?.redisPassword || process.env.REDIS_PASSWORD,
      // ... other redis config
    },

    security: {
      sessionSecret: secrets?.sessionSecret || getRequiredEnv('SESSION_SECRET'),
      jwtSecret: secrets?.jwtSecret || process.env.JWT_SECRET,
      // ... other security config
    },

    // ... rest of config
  };

  return config;
}
```

---

## Step 9: Dynamic Database Secrets (Advanced)

For enhanced security, use Vault's database secrets engine to generate dynamic credentials:

```bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="zero-to-running" \
  connection_url="postgresql://{{username}}:{{password}}@db.example.com:5432/zero_to_running" \
  username="vault" \
  password="vault-password"

# Create role for dynamic credentials
vault write database/roles/zero-to-running \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"
```

Request dynamic credentials:

```typescript
async function getDynamicDatabaseCreds() {
  const response = await vaultClient.read('database/creds/zero-to-running');
  return {
    username: response.data.username,
    password: response.data.password,
    lease_id: response.lease_id,
    lease_duration: response.lease_duration,
  };
}
```

---

## Testing

### Test Vault Connection Locally

```bash
# Set Vault address
export VAULT_ADDR=https://vault.example.com:8200

# Login with token (for testing)
vault login

# Test secret retrieval
vault kv get secret/production/zero-to-running/database
```

### Test Application Startup

```bash
export USE_VAULT_SECRETS=true
export VAULT_ADDR=https://vault.example.com:8200
export VAULT_ROLE_ID=your-role-id
export VAULT_SECRET_ID=your-secret-id

npm start
```

---

## Security Considerations

1. **TLS Encryption**: Always use HTTPS for Vault communication
2. **Secret ID Protection**: Treat secret_id like a password
3. **Token Renewal**: Implement automatic token renewal
4. **Least Privilege**: Grant minimal policy permissions
5. **Audit Logging**: Enable and monitor Vault audit logs
6. **High Availability**: Run Vault in HA mode for production

---

## Alternative: Kubernetes Auth

If running on Kubernetes, use Kubernetes auth instead of AppRole:

```bash
# Enable Kubernetes auth
vault auth enable kubernetes

# Configure Kubernetes auth
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

# Create role for service account
vault write auth/kubernetes/role/zero-to-running \
  bound_service_account_names=zero-to-running \
  bound_service_account_namespaces=production \
  policies=zero-to-running \
  ttl=1h
```

---

## References

- [Vault Documentation](https://www.vaultproject.io/docs)
- [Vault API](https://www.vaultproject.io/api-docs)
- [node-vault NPM Package](https://www.npmjs.com/package/node-vault)
- [AppRole Auth Method](https://www.vaultproject.io/docs/auth/approle)
- [Database Secrets Engine](https://www.vaultproject.io/docs/secrets/databases/postgresql)
