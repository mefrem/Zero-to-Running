# AWS Secrets Manager Integration

This guide shows how to integrate Zero-to-Running with AWS Secrets Manager for production secret management.

## Overview

AWS Secrets Manager is a fully managed service for storing, retrieving, and rotating secrets. It integrates seamlessly with other AWS services and provides:

- **Automatic secret rotation** for databases and services
- **Fine-grained IAM access control**
- **Encryption at rest** using AWS KMS
- **Audit logging** via AWS CloudTrail
- **Integration with RDS, ECS, Lambda, and more**

---

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI installed and configured
- Application deployed to AWS (ECS, EC2, Lambda, etc.)
- IAM role for the application with Secrets Manager access

---

## Step 1: Store Secrets in AWS Secrets Manager

### Create Secrets via AWS CLI

```bash
# Store database password
aws secretsmanager create-secret \
  --name production/zero-to-running/database-password \
  --description "PostgreSQL password for Zero-to-Running production" \
  --secret-string "$(openssl rand -base64 32)"

# Store Redis password
aws secretsmanager create-secret \
  --name production/zero-to-running/redis-password \
  --description "Redis password for Zero-to-Running production" \
  --secret-string "$(openssl rand -base64 32)"

# Store session secret
aws secretsmanager create-secret \
  --name production/zero-to-running/session-secret \
  --description "Session secret for Zero-to-Running production" \
  --secret-string "$(openssl rand -base64 32)"

# Store JWT secret
aws secretsmanager create-secret \
  --name production/zero-to-running/jwt-secret \
  --description "JWT signing secret for Zero-to-Running production" \
  --secret-string "$(openssl rand -base64 32)"
```

### Create Secrets via AWS Console

1. Navigate to **AWS Secrets Manager** in AWS Console
2. Click **Store a new secret**
3. Choose **Other type of secret**
4. Add key-value pairs:
   - Key: `password`, Value: `<generated-password>`
5. Name the secret: `production/zero-to-running/database-password`
6. Configure automatic rotation (optional)
7. Review and store

---

## Step 2: Grant IAM Permissions

Create an IAM policy for the application to read secrets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:production/zero-to-running/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:123456789012:key/abc-123-def-456"
      ]
    }
  ]
}
```

Attach this policy to the IAM role used by your application (ECS task role, EC2 instance role, Lambda execution role, etc.).

---

## Step 3: Install AWS SDK

Add the AWS SDK to your backend dependencies:

```bash
cd backend
npm install @aws-sdk/client-secrets-manager
```

---

## Step 4: Create Secret Loading Module

Create `/backend/src/config/aws-secrets.ts`:

```typescript
/**
 * AWS Secrets Manager Integration
 * Loads secrets from AWS Secrets Manager in production environments
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../utils/logger';

// Initialize AWS Secrets Manager client
const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Retrieve a secret value from AWS Secrets Manager
 * @param secretName - The name/ARN of the secret
 * @returns The secret value as a string
 */
export async function getSecret(secretName: string): Promise<string> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);

    if (response.SecretString) {
      return response.SecretString;
    }

    if (response.SecretBinary) {
      // For binary secrets
      const buff = Buffer.from(response.SecretBinary);
      return buff.toString('ascii');
    }

    throw new Error(`Secret ${secretName} has no value`);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve secret from AWS Secrets Manager',
      secretName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Load all application secrets from AWS Secrets Manager
 * @returns Object containing all secret values
 */
export async function loadSecretsFromAWS(): Promise<{
  databasePassword: string;
  redisPassword?: string;
  sessionSecret: string;
  jwtSecret?: string;
}> {
  const environment = process.env.NODE_ENV || 'production';
  const secretPrefix = `${environment}/zero-to-running`;

  logger.info({
    msg: 'Loading secrets from AWS Secrets Manager',
    environment,
    secretPrefix,
  });

  try {
    const [databasePassword, redisPassword, sessionSecret, jwtSecret] =
      await Promise.all([
        getSecret(`${secretPrefix}/database-password`),
        getSecret(`${secretPrefix}/redis-password`).catch(() => undefined),
        getSecret(`${secretPrefix}/session-secret`),
        getSecret(`${secretPrefix}/jwt-secret`).catch(() => undefined),
      ]);

    logger.info({
      msg: 'Successfully loaded secrets from AWS Secrets Manager',
      loadedSecrets: [
        'database-password',
        redisPassword ? 'redis-password' : null,
        'session-secret',
        jwtSecret ? 'jwt-secret' : null,
      ].filter(Boolean),
    });

    return {
      databasePassword,
      redisPassword,
      sessionSecret,
      jwtSecret,
    };
  } catch (error) {
    logger.error({
      msg: 'Failed to load secrets from AWS Secrets Manager',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

---

## Step 5: Update Environment Configuration

Modify `/backend/src/config/env.ts` to load secrets from AWS in production:

```typescript
import { loadSecretsFromAWS } from './aws-secrets';

/**
 * Load configuration with AWS Secrets Manager integration
 */
export async function loadConfigWithSecrets(): Promise<AppConfig> {
  let secrets;

  // Load secrets from AWS Secrets Manager in production
  if (process.env.NODE_ENV === 'production' && process.env.USE_AWS_SECRETS === 'true') {
    secrets = await loadSecretsFromAWS();
  }

  const config: AppConfig = {
    // ... other config

    database: {
      host: getOptionalEnv('DATABASE_HOST', 'postgres'),
      port: getIntEnv('DATABASE_PORT', 5432),
      name: getOptionalEnv('DATABASE_NAME', 'zero_to_running'),
      user: getOptionalEnv('DATABASE_USER', 'postgres'),
      // Use AWS secret if available, otherwise fall back to env var
      password: secrets?.databasePassword || getRequiredEnv('DATABASE_PASSWORD'),
      poolMin: getIntEnv('DATABASE_POOL_MIN', 2),
      poolMax: getIntEnv('DATABASE_POOL_MAX', 10),
    },

    redis: {
      host: getOptionalEnv('REDIS_HOST', 'redis'),
      port: getIntEnv('REDIS_PORT', 6379),
      // Use AWS secret if available
      password: secrets?.redisPassword || process.env.REDIS_PASSWORD,
      db: getIntEnv('REDIS_DB', 0),
    },

    security: {
      // Use AWS secret if available, otherwise fall back to env var
      sessionSecret: secrets?.sessionSecret || getRequiredEnv('SESSION_SECRET'),
      sessionMaxAge: getIntEnv('SESSION_MAX_AGE', 86400000),
      jwtSecret: secrets?.jwtSecret || process.env.JWT_SECRET,
      jwtExpiration: process.env.JWT_EXPIRATION,
      bcryptSaltRounds: getIntEnv('BCRYPT_SALT_ROUNDS', 10),
      enableHttps: getBoolEnv('ENABLE_HTTPS', false),
    },

    // ... rest of config
  };

  // Validate the loaded configuration
  validateConfig(config);

  return config;
}
```

---

## Step 6: Update Application Startup

Modify `/backend/src/index.ts` to use async config loading:

```typescript
async function startApplication(): Promise<void> {
  try {
    // Load configuration with AWS secrets
    const config = await loadConfigWithSecrets();

    // ... rest of startup logic
  } catch (error) {
    logger.error('Failed to start application', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}
```

---

## Step 7: Configure Environment Variables

Set environment variables for AWS integration:

```bash
# Enable AWS Secrets Manager
USE_AWS_SECRETS=true

# AWS configuration
AWS_REGION=us-east-1

# Application role will use IAM for authentication
# No AWS credentials needed if using IAM roles (ECS, EC2, Lambda)
```

---

## Step 8: Deploy to AWS

### For ECS (Elastic Container Service)

In your ECS task definition:

```json
{
  "family": "zero-to-running",
  "taskRoleArn": "arn:aws:iam::123456789012:role/zero-to-running-task-role",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "zero-to-running:latest",
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "USE_AWS_SECRETS",
          "value": "true"
        },
        {
          "name": "AWS_REGION",
          "value": "us-east-1"
        }
      ]
    }
  ]
}
```

The task role (`zero-to-running-task-role`) should have the IAM policy from Step 2 attached.

### For EC2

1. Attach IAM role to EC2 instance with Secrets Manager permissions
2. Set environment variables in systemd service file or Docker Compose
3. Application will automatically use instance role credentials

---

## Step 9: Configure Automatic Rotation

Enable automatic rotation for database password:

```bash
aws secretsmanager rotate-secret \
  --secret-id production/zero-to-running/database-password \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRDSPostgreSQLRotationSingleUser \
  --rotation-rules AutomaticallyAfterDays=30
```

AWS will automatically:

- Generate a new password every 30 days
- Update the secret in Secrets Manager
- Update the RDS database password
- Handle zero-downtime rotation

---

## Testing

### Test Secret Retrieval Locally

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1

# Test secret retrieval
aws secretsmanager get-secret-value \
  --secret-id production/zero-to-running/database-password \
  --query SecretString \
  --output text
```

### Test Application Startup

```bash
# Enable AWS secrets
export USE_AWS_SECRETS=true
export AWS_REGION=us-east-1

# Start application
npm start
```

Verify logs show:

```
Loading secrets from AWS Secrets Manager
Successfully loaded secrets from AWS Secrets Manager
```

---

## Security Considerations

1. **IAM Least Privilege**: Grant only `GetSecretValue` on specific secrets
2. **KMS Encryption**: Use customer-managed KMS keys for additional control
3. **Audit Logging**: Enable CloudTrail to track all secret access
4. **Secret Naming**: Use consistent naming convention with environment prefix
5. **Rotation**: Enable automatic rotation for database secrets
6. **Versioning**: Secrets Manager maintains version history automatically

---

## Cost Considerations

AWS Secrets Manager pricing (as of 2024):

- **$0.40 per secret per month**
- **$0.05 per 10,000 API calls**

Example cost for Zero-to-Running:

- 4 secrets (database, redis, session, jwt): $1.60/month
- ~100,000 API calls/month: $0.50/month
- **Total: ~$2.10/month**

---

## Troubleshooting

### "Access Denied" Error

**Cause:** IAM role doesn't have Secrets Manager permissions

**Solution:**

1. Verify IAM policy is attached to role
2. Check secret ARN in policy matches actual secret
3. Ensure KMS decrypt permission is granted

### "Secret Not Found" Error

**Cause:** Secret name mismatch or secret doesn't exist

**Solution:**

1. List secrets: `aws secretsmanager list-secrets`
2. Verify secret name matches code
3. Check environment prefix is correct

### Application Fails to Start

**Cause:** Secrets loading timeout or network issue

**Solution:**

1. Increase startup timeout
2. Check VPC endpoints for Secrets Manager
3. Verify security group allows HTTPS outbound traffic

---

## Alternative: Secret Binary Storage

For storing JSON objects or complex secrets:

```typescript
// Store structured secret
const secretData = {
  username: 'admin',
  password: 'secret123',
  connectionString: 'postgresql://...',
};

await client.send(
  new PutSecretValueCommand({
    SecretId: 'my-app/database-config',
    SecretString: JSON.stringify(secretData),
  })
);

// Retrieve and parse
const secret = await getSecret('my-app/database-config');
const data = JSON.parse(secret);
```

---

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/)
- [IAM Policies for Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access.html)
- [Automatic Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
