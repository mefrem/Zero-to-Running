-- ============================================================================
-- Zero-to-Running Database Seed Script
-- ============================================================================
-- Purpose: Populate database with realistic test data for development
-- Idempotency: Safe to run multiple times (uses INSERT ... ON CONFLICT)
-- Usage: Run via 'make seed' or automatically with AUTO_SEED_DATABASE=true
--
-- Test Data Overview:
-- - 5 test users with different states (active/inactive, verified/unverified)
-- - 2 active sessions for logged-in users
-- - 3 API keys for API testing
-- - Sample audit logs showing user activity
-- - Historical health check records
-- ============================================================================

-- ============================================================================
-- USERS TABLE - Test user accounts
-- ============================================================================

-- Hash for password: 'password123' (using pgcrypto crypt function)
-- In real application, passwords should be hashed with bcrypt
-- For testing, we use a consistent hash for predictable login testing

-- User 1: Active, verified admin user
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified, created_at, updated_at, last_login_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    'admin',
    crypt('password123', gen_salt('bf')),
    'Admin',
    'User',
    true,
    true,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 hour'
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified,
    updated_at = EXCLUDED.updated_at,
    last_login_at = EXCLUDED.last_login_at;

-- User 2: Active, verified regular user
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified, created_at, updated_at, last_login_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'john.doe@example.com',
    'johndoe',
    crypt('password123', gen_salt('bf')),
    'John',
    'Doe',
    true,
    true,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '3 hours'
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified,
    updated_at = EXCLUDED.updated_at,
    last_login_at = EXCLUDED.last_login_at;

-- User 3: Active but unverified user (email not confirmed)
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified, created_at, updated_at, last_login_at)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'jane.smith@example.com',
    'janesmith',
    crypt('password123', gen_salt('bf')),
    'Jane',
    'Smith',
    true,
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NULL
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified,
    updated_at = EXCLUDED.updated_at,
    last_login_at = EXCLUDED.last_login_at;

-- User 4: Inactive (disabled) user
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified, created_at, updated_at, last_login_at)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    'disabled.user@example.com',
    'disableduser',
    crypt('password123', gen_salt('bf')),
    'Disabled',
    'User',
    false,
    true,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '30 days'
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified,
    updated_at = EXCLUDED.updated_at,
    last_login_at = EXCLUDED.last_login_at;

-- User 5: Active developer user for API testing
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_verified, created_at, updated_at, last_login_at)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    'developer@example.com',
    'developer',
    crypt('password123', gen_salt('bf')),
    'Developer',
    'Tester',
    true,
    true,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    is_verified = EXCLUDED.is_verified,
    updated_at = EXCLUDED.updated_at,
    last_login_at = EXCLUDED.last_login_at;

-- ============================================================================
-- SESSIONS TABLE - Active user sessions
-- ============================================================================

-- Session for admin user (expires in 7 days)
INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin_session_token_' || md5(random()::text),
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '1 hour'
)
ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    expires_at = EXCLUDED.expires_at;

-- Session for john.doe user (expires in 7 days)
INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
VALUES (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'johndoe_session_token_' || md5(random()::text),
    '192.168.1.101',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '3 hours'
)
ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    expires_at = EXCLUDED.expires_at;

-- ============================================================================
-- API_KEYS TABLE - API authentication keys
-- ============================================================================

-- API Key 1: Admin's production API key
INSERT INTO api_keys (id, user_id, key_hash, name, description, is_active, last_used_at, expires_at, created_at, updated_at)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'sk_' || md5('admin_production_key'),
    'Production API Key',
    'Main API key for production integrations',
    true,
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '365 days',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '2 hours'
)
ON CONFLICT (key_hash) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    last_used_at = EXCLUDED.last_used_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

-- API Key 2: Developer's test API key
INSERT INTO api_keys (id, user_id, key_hash, name, description, is_active, last_used_at, expires_at, created_at, updated_at)
VALUES (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000005',
    'sk_' || md5('developer_test_key'),
    'Development Test Key',
    'API key for development and testing',
    true,
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '90 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (key_hash) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    last_used_at = EXCLUDED.last_used_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

-- API Key 3: Inactive/expired API key
INSERT INTO api_keys (id, user_id, key_hash, name, description, is_active, last_used_at, expires_at, created_at, updated_at)
VALUES (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'sk_' || md5('johndoe_old_key'),
    'Old API Key',
    'Deprecated API key - no longer in use',
    false,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '60 days'
)
ON CONFLICT (key_hash) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    last_used_at = EXCLUDED.last_used_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- AUDIT_LOGS TABLE - User activity history
-- ============================================================================

-- Audit log 1: Admin user login
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'USER_LOGIN',
    'user',
    '00000000-0000-0000-0000-000000000001',
    '{"method": "password", "success": true}'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    changes = EXCLUDED.changes,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    created_at = EXCLUDED.created_at;

-- Audit log 2: User profile update
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'USER_UPDATE',
    'user',
    '00000000-0000-0000-0000-000000000002',
    '{"fields_changed": ["first_name", "last_name"], "old_values": {"first_name": "Jon"}, "new_values": {"first_name": "John"}}'::jsonb,
    '192.168.1.101',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    changes = EXCLUDED.changes,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    created_at = EXCLUDED.created_at;

-- Audit log 3: API key creation
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000005',
    'API_KEY_CREATE',
    'api_key',
    '20000000-0000-0000-0000-000000000002',
    '{"name": "Development Test Key", "expires_at": "90 days"}'::jsonb,
    '192.168.1.102',
    'curl/7.88.0',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    changes = EXCLUDED.changes,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    created_at = EXCLUDED.created_at;

-- Audit log 4: Failed login attempt
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000004',
    NULL,
    'USER_LOGIN_FAILED',
    'user',
    NULL,
    '{"email": "unknown@example.com", "reason": "invalid_credentials"}'::jsonb,
    '192.168.1.200',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '5 hours'
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    changes = EXCLUDED.changes,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    created_at = EXCLUDED.created_at;

-- Audit log 5: User account disabled
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
VALUES (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'USER_DISABLE',
    'user',
    '00000000-0000-0000-0000-000000000004',
    '{"reason": "account_inactivity", "disabled_by": "admin@example.com"}'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '15 days'
)
ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    action = EXCLUDED.action,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    changes = EXCLUDED.changes,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    created_at = EXCLUDED.created_at;

-- ============================================================================
-- HEALTH_CHECKS TABLE - Historical health check data
-- ============================================================================

-- Recent successful health check
INSERT INTO health_checks (id, service_name, status, message, checked_at)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    'database',
    'healthy',
    'All database connections active and responsive',
    NOW() - INTERVAL '5 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    checked_at = EXCLUDED.checked_at;

-- Backend health check
INSERT INTO health_checks (id, service_name, status, message, checked_at)
VALUES (
    '40000000-0000-0000-0000-000000000002',
    'backend',
    'healthy',
    'Backend API responding normally',
    NOW() - INTERVAL '5 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    checked_at = EXCLUDED.checked_at;

-- Redis health check
INSERT INTO health_checks (id, service_name, status, message, checked_at)
VALUES (
    '40000000-0000-0000-0000-000000000003',
    'redis',
    'healthy',
    'Redis cache operational',
    NOW() - INTERVAL '5 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    checked_at = EXCLUDED.checked_at;

-- Historical degraded health check (for testing)
INSERT INTO health_checks (id, service_name, status, message, checked_at)
VALUES (
    '40000000-0000-0000-0000-000000000004',
    'database',
    'degraded',
    'High connection count detected',
    NOW() - INTERVAL '2 hours'
)
ON CONFLICT (id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    checked_at = EXCLUDED.checked_at;

-- ============================================================================
-- Completion and Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Database Seed Completed Successfully!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Data Summary:';
    RAISE NOTICE '  - Users: 5 (admin, johndoe, janesmith, disableduser, developer)';
    RAISE NOTICE '  - Sessions: 2 active sessions';
    RAISE NOTICE '  - API Keys: 3 (2 active, 1 inactive)';
    RAISE NOTICE '  - Audit Logs: 5 activity records';
    RAISE NOTICE '  - Health Checks: 4 historical records';
    RAISE NOTICE '';
    RAISE NOTICE 'Test User Credentials (all users have same password):';
    RAISE NOTICE '  Email: admin@example.com         | Password: password123';
    RAISE NOTICE '  Email: john.doe@example.com      | Password: password123';
    RAISE NOTICE '  Email: jane.smith@example.com    | Password: password123';
    RAISE NOTICE '  Email: developer@example.com     | Password: password123';
    RAISE NOTICE '';
    RAISE NOTICE 'Idempotent: This script can be run multiple times safely.';
    RAISE NOTICE '============================================================';
END $$;
