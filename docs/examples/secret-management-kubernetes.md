# Kubernetes Secrets Integration

This guide shows how to integrate Zero-to-Running with Kubernetes Secrets for production deployments on Kubernetes.

## Overview

Kubernetes Secrets provide a native way to store and manage sensitive information in Kubernetes clusters:

- **Native integration** with Kubernetes
- **RBAC access control** using Kubernetes permissions
- **Pod-level injection** as environment variables or mounted files
- **Base64 encoding** (not encryption by default)
- **External Secrets Operator** for cloud integration

---

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` CLI configured
- Application containerized and ready for Kubernetes deployment

---

## Step 1: Create Kubernetes Secrets

### Using kubectl create secret

```bash
# Create secret from literal values
kubectl create secret generic zero-to-running-secrets \
  --from-literal=database-password=$(openssl rand -base64 32) \
  --from-literal=redis-password=$(openssl rand -base64 32) \
  --from-literal=session-secret=$(openssl rand -base64 32) \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --namespace=production

# Verify secret created
kubectl get secrets -n production
kubectl describe secret zero-to-running-secrets -n production
```

### Using YAML Manifest

Create `kubernetes/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: zero-to-running-secrets
  namespace: production
type: Opaque
data:
  # Base64 encoded values
  database-password: <base64-encoded-password>
  redis-password: <base64-encoded-password>
  session-secret: <base64-encoded-secret>
  jwt-secret: <base64-encoded-secret>
stringData:
  # Plain text values (automatically base64 encoded)
  database-host: postgres.production.svc.cluster.local
  database-name: zero_to_running
  database-user: postgres
```

Generate base64 values:

```bash
echo -n "my-secret-password" | base64
```

Apply the secret:

```bash
kubectl apply -f kubernetes/secrets.yaml
```

---

## Step 2: Create Deployment with Secret Injection

Create `kubernetes/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zero-to-running-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zero-to-running
      component: backend
  template:
    metadata:
      labels:
        app: zero-to-running
        component: backend
    spec:
      serviceAccountName: zero-to-running
      containers:
        - name: backend
          image: zero-to-running/backend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
              protocol: TCP
          env:
            # Application environment
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3001"

            # Database configuration from secret
            - name: DATABASE_HOST
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: database-host
            - name: DATABASE_NAME
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: database-name
            - name: DATABASE_USER
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: database-user
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: database-password

            # Redis configuration from secret
            - name: REDIS_HOST
              value: "redis.production.svc.cluster.local"
            - name: REDIS_PORT
              value: "6379"
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: redis-password

            # Security secrets
            - name: SESSION_SECRET
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: session-secret
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: zero-to-running-secrets
                  key: jwt-secret
                  optional: true

          # Health checks
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5

          # Resource limits
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

Apply the deployment:

```bash
kubectl apply -f kubernetes/deployment.yaml
```

---

## Step 3: Create Service Account and RBAC

Create `kubernetes/rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: zero-to-running
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: zero-to-running-secrets-reader
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["zero-to-running-secrets"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: zero-to-running-secrets-binding
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: zero-to-running-secrets-reader
subjects:
  - kind: ServiceAccount
    name: zero-to-running
    namespace: production
```

Apply RBAC configuration:

```bash
kubectl apply -f kubernetes/rbac.yaml
```

---

## Step 4: Volume Mount Approach (Alternative)

Instead of environment variables, mount secrets as files:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zero-to-running-backend
spec:
  template:
    spec:
      containers:
        - name: backend
          # ... other config
          volumeMounts:
            - name: secrets
              mountPath: "/etc/secrets"
              readOnly: true
      volumes:
        - name: secrets
          secret:
            secretName: zero-to-running-secrets
            items:
              - key: database-password
                path: database-password
              - key: session-secret
                path: session-secret
```

Read secrets from files in application:

```typescript
import { readFileSync } from 'fs';

const databasePassword = readFileSync('/etc/secrets/database-password', 'utf8').trim();
const sessionSecret = readFileSync('/etc/secrets/session-secret', 'utf8').trim();
```

---

## Step 5: External Secrets Operator (Cloud Integration)

For integration with AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager:

### Install External Secrets Operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### Configure AWS Secrets Manager Integration

Create `kubernetes/external-secret.yaml`:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: zero-to-running-external-secret
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: zero-to-running-secrets
    creationPolicy: Owner
  data:
    - secretKey: database-password
      remoteRef:
        key: production/zero-to-running/database-password
    - secretKey: redis-password
      remoteRef:
        key: production/zero-to-running/redis-password
    - secretKey: session-secret
      remoteRef:
        key: production/zero-to-running/session-secret
    - secretKey: jwt-secret
      remoteRef:
        key: production/zero-to-running/jwt-secret
```

Apply:

```bash
kubectl apply -f kubernetes/external-secret.yaml
```

The External Secrets Operator will:

- Fetch secrets from AWS Secrets Manager
- Create/update Kubernetes Secret
- Refresh secrets on schedule
- Handle rotation automatically

---

## Step 6: Encryption at Rest (Enhanced Security)

Enable encryption at rest for etcd (where secrets are stored):

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
```

Pass to kube-apiserver:

```bash
--encryption-provider-config=/path/to/encryption-config.yaml
```

---

## Testing

### Verify Secret Created

```bash
# List secrets
kubectl get secrets -n production

# Describe secret (doesn't show values)
kubectl describe secret zero-to-running-secrets -n production

# View secret values (base64 encoded)
kubectl get secret zero-to-running-secrets -n production -o yaml

# Decode a specific value
kubectl get secret zero-to-running-secrets -n production -o jsonpath='{.data.database-password}' | base64 --decode
```

### Test Pod Can Access Secrets

```bash
# Get pod name
POD=$(kubectl get pods -n production -l app=zero-to-running -o jsonpath='{.items[0].metadata.name}')

# Check environment variables
kubectl exec -n production $POD -- env | grep DATABASE_PASSWORD

# If using volume mounts
kubectl exec -n production $POD -- cat /etc/secrets/database-password
```

### View Application Logs

```bash
kubectl logs -n production -l app=zero-to-running --tail=100 -f
```

---

## Security Best Practices

1. **Use RBAC**: Restrict secret access to specific service accounts
2. **Enable Encryption at Rest**: Encrypt secrets in etcd
3. **Use External Secrets Operator**: For cloud secret managers
4. **Rotate Secrets Regularly**: Implement secret rotation process
5. **Avoid Hardcoding**: Never hardcode secrets in images or configs
6. **Use Namespaces**: Isolate secrets per environment
7. **Audit Access**: Monitor secret access via audit logs
8. **Limit Secret Scope**: Create separate secrets for each service

---

## Secret Rotation

To rotate secrets without downtime:

```bash
# Generate new secret value
NEW_PASSWORD=$(openssl rand -base64 32)

# Update secret
kubectl create secret generic zero-to-running-secrets \
  --from-literal=database-password=$NEW_PASSWORD \
  --namespace=production \
  --dry-run=client -o yaml | kubectl apply -f -

# Rolling restart of pods to pick up new secret
kubectl rollout restart deployment/zero-to-running-backend -n production

# Monitor rollout
kubectl rollout status deployment/zero-to-running-backend -n production
```

---

## Troubleshooting

### Pods Can't Access Secrets

**Cause:** RBAC permissions not configured

**Solution:**

1. Verify service account exists
2. Check RBAC role and binding
3. Ensure secret name matches in deployment

### Secrets Not Updating in Pods

**Cause:** Secrets mounted as environment variables don't update automatically

**Solution:**

- Use volume mounts for secrets (auto-updates)
- OR trigger rolling restart after secret update

### Base64 Encoding Issues

**Cause:** Newlines or extra characters in base64 encoding

**Solution:**

```bash
# Use -n flag with echo to avoid newlines
echo -n "my-secret" | base64
```

---

## GitOps Integration (ArgoCD/Flux)

For GitOps workflows, use **Sealed Secrets** or **SOPS**:

### Sealed Secrets

```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# Seal a secret
kubeseal -f secret.yaml -w sealed-secret.yaml

# Commit sealed-secret.yaml to Git (safe to commit!)
```

### SOPS (Secret OPerationS)

```bash
# Encrypt secrets with SOPS
sops --encrypt --kms "arn:aws:kms:..." secret.yaml > secret.enc.yaml

# Commit encrypted file to Git
```

---

## References

- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [SOPS](https://github.com/mozilla/sops)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
