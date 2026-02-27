# Push Notification Production Setup Guide

## Overview

The freight management platform supports push notifications for both Android (via Firebase Cloud Messaging) and iOS (via Apple Push Notification Service). This guide covers the production setup requirements.

## Environment Variables Required

### Firebase Cloud Messaging (Android)

```env
# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your-private-key...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

### Apple Push Notification Service (iOS)

```env
# APNs credentials
APNS_KEY_ID=ABCD1234EF          # 10-character Key ID from Apple
APNS_TEAM_ID=TEAM123456         # 10-character Team ID
APNS_KEY_FILE=/path/to/AuthKey_ABCD1234EF.p8
APNS_BUNDLE_ID=com.yourcompany.freight
```

## Setup Instructions

### 1. Firebase (FCM) Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project or select existing one
   - Enable Cloud Messaging

2. **Generate Service Account Key**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

3. **Extract Credentials**
   From the downloaded JSON file, extract:
   - `project_id` → FIREBASE_PROJECT_ID
   - `private_key` → FIREBASE_PRIVATE_KEY (escape newlines as \n)
   - `client_email` → FIREBASE_CLIENT_EMAIL

4. **Configure Android App**
   - Register your Android app in Firebase
   - Download `google-services.json`
   - Place in `mobile/android/app/google-services.json`

### 2. Apple (APNs) Setup

1. **Create APNs Key**
   - Go to [Apple Developer Portal](https://developer.apple.com)
   - Navigate to Certificates, Identifiers & Profiles
   - Go to Keys section
   - Create a new key with "Apple Push Notifications service (APNs)"
   - Download the .p8 file (can only be downloaded once!)

2. **Get Key Information**
   - APNS_KEY_ID: Displayed after creating the key (10 characters)
   - APNS_TEAM_ID: Found in Account > Membership (10 characters)
   - APNS_KEY_FILE: Path to your downloaded .p8 file
   - APNS_BUNDLE_ID: Your iOS app bundle identifier

3. **Store Key Securely**
   - Copy the .p8 file to a secure location on your server
   - Set appropriate file permissions (readable by app only)

### 3. Mobile App Configuration

#### Android (Flutter)

In `mobile/android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

In `mobile/android/build.gradle`:

```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
}
```

#### iOS (Flutter)

In `mobile/ios/Runner/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## Verification

### Check Configuration Status

```bash
# Health check endpoint
curl https://your-domain.com/api/health

# Response will include push notification status:
# {
#   "push": {
#     "fcmConfigured": true,
#     "apnsConfigured": true
#   }
# }
```

### Test Notification

```bash
# Send test notification (requires authentication)
curl -X POST https://your-domain.com/api/test/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "title": "Test Notification",
    "body": "This is a test push notification"
  }'
```

## Security Best Practices

1. **Never commit credentials to git**
   - Use environment variables
   - Store in secure secret management (AWS Secrets Manager, HashiCorp Vault, etc.)

2. **Rotate keys periodically**
   - Firebase: Generate new service account keys every 90 days
   - APNs: Keys don't expire but should be rotated for security

3. **Limit key permissions**
   - Firebase: Use service account with minimal required permissions
   - APNs: Keys are limited to push notification scope by design

4. **Monitor usage**
   - Track notification delivery rates
   - Alert on unusual patterns (spam, failures)

## Troubleshooting

### FCM Issues

| Issue                                         | Solution                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| `messaging/registration-token-not-registered` | Token expired or app uninstalled, remove from database |
| `messaging/invalid-registration-token`        | Token format invalid, verify token format              |
| `messaging/authentication-error`              | Check FIREBASE_PRIVATE_KEY format                      |

### APNs Issues

| Issue                  | Solution                         |
| ---------------------- | -------------------------------- |
| `BadDeviceToken`       | Token invalid or app reinstalled |
| `Unregistered`         | User disabled notifications      |
| `ExpiredProviderToken` | Key may be revoked, regenerate   |

## Notification Types

The platform supports these notification types:

| Type                 | Trigger                   | Priority |
| -------------------- | ------------------------- | -------- |
| `load_request`       | New load request received | High     |
| `load_assigned`      | Load assigned to carrier  | High     |
| `load_status_change` | Load status updated       | Normal   |
| `trip_started`       | Trip begins               | High     |
| `trip_completed`     | Trip delivered            | High     |
| `payment_received`   | Payment completed         | High     |
| `bid_received`       | New bid on load           | High     |
| `bid_accepted`       | Bid was accepted          | High     |
| `document_required`  | Document upload needed    | Normal   |
| `chat_message`       | New chat message          | High     |
| `system_alert`       | System notification       | High     |

## Production Checklist

- [ ] Firebase project created in production mode
- [ ] Service account key generated and stored securely
- [ ] APNs key created and downloaded
- [ ] Environment variables set in production
- [ ] google-services.json added to Android app
- [ ] iOS entitlements configured
- [ ] Health endpoint confirms both services configured
- [ ] Test notification sent and received successfully
- [ ] Monitoring and alerting configured

---

**Document Version:** 1.0
**Last Updated:** January 2026
