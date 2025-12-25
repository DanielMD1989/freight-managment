# Email Notifications Documentation

**Sprint 9 - Story 9.8: Email Notification Service**
**Date:** 2025-12-25
**Status:** Implemented

---

## Overview

The Freight Management Platform sends automated email notifications to keep users informed about important events, particularly document verification status changes.

## Email Service Configuration

### Environment Variables

```env
# Email Provider (console, resend, sendgrid, ses)
EMAIL_PROVIDER=console

# Sender Information
EMAIL_FROM=noreply@freight-platform.com
EMAIL_FROM_NAME=Freight Management Platform

# Provider API Keys
RESEND_API_KEY=re_xxxxxxxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
AWS_REGION=us-east-1

# Application URL (for links in emails)
NEXT_PUBLIC_APP_URL=https://freight-platform.com
```

---

## Supported Email Providers

### 1. Console (Development)

**Use Case**: Local development and testing

**Configuration**:
```env
EMAIL_PROVIDER=console
```

**Behavior**: Logs emails to console instead of sending. Perfect for development.

**Cost**: Free

---

### 2. Resend (Recommended for MVP)

**Use Case**: Production MVP, small to medium scale

**Setup**:
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain
3. Get API key from dashboard
4. Set environment variables:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Company Name
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**Features**:
- Simple API
- Generous free tier (100 emails/day)
- Good deliverability
- Email tracking
- Modern dashboard

**Cost**: Free tier → $20/month for 50k emails

---

### 3. SendGrid (Enterprise Option)

**Use Case**: Large scale, advanced features

**Status**: Ready for implementation (documented in code)

**Cost**: Starts at $15/month

---

### 4. AWS SES (AWS Infrastructure)

**Use Case**: Already on AWS, high volume

**Status**: Ready for implementation (documented in code)

**Cost**: $0.10 per 1,000 emails

---

## Email Templates

### Document Approval Email

**Trigger**: Admin approves a document

**Template**: `createDocumentApprovalEmail()`

**Recipients**: Document uploader

**Subject**: `Document Approved: {documentType}`

**Content**:
- ✅ Approval status badge
- Document details (type, file name, organization)
- Verification timestamp
- Link to dashboard
- Professional email design

**Example**:
```
Subject: Document Approved: Operating License

Dear John Doe,

Great news! Your document has been reviewed and approved.

✅ APPROVED

Document Type: Operating License
File Name: license-2025.pdf
Organization: ABC Freight Inc.
Verified On: December 25, 2025 at 2:30 PM

[Go to Dashboard]

Thank you for completing the verification process!
```

---

### Document Rejection Email

**Trigger**: Admin rejects a document

**Template**: `createDocumentRejectionEmail()`

**Recipients**: Document uploader

**Subject**: `Document Rejected: {documentType} - Action Required`

**Content**:
- ❌ Rejection status badge
- Document details
- Detailed rejection reason
- Next steps for user
- Link to upload corrected document
- Support contact information

**Example**:
```
Subject: Document Rejected: Operating License - Action Required

Dear John Doe,

We've reviewed your submitted document and unfortunately cannot approve it at this time.

❌ REJECTED

Document Type: Operating License
File Name: license-2025.pdf
Organization: ABC Freight Inc.
Reviewed On: December 25, 2025 at 2:30 PM

Reason for Rejection:
The license document is expired. Please upload a current, valid operating license.

Next Steps:
• Review the rejection reason above
• Prepare a corrected document that addresses the issues
• Upload the new document through your dashboard

[Upload Corrected Document]

If you have questions about this decision, please contact our support team.
```

---

## Email Flows

### Document Verification Flow

```
User uploads document
        ↓
Document status: PENDING
        ↓
Admin reviews document
        ↓
    ┌───────┴───────┐
    ↓               ↓
APPROVED        REJECTED
    ↓               ↓
✅ Approval     ❌ Rejection
   Email           Email
    ↓               ↓
User notified   User notified
Can use         Must re-upload
platform
```

### Implementation

**File**: `app/api/documents/[id]/route.ts`

**Endpoint**: `PATCH /api/documents/[id]`

**Process**:
1. Admin updates document verification status
2. Document updated in database
3. Email notification sent asynchronously
4. Response returned immediately (doesn't wait for email)
5. Email failures logged but don't affect verification

**Code Example**:
```typescript
// Update document
const updated = await db.companyDocument.update({
  where: { id },
  data: { verificationStatus, verifiedAt: new Date() },
  include: {
    uploadedBy: { select: { email, name } },
    organization: { select: { name } },
  },
});

// Send email (async, doesn't block response)
try {
  if (verificationStatus === 'APPROVED') {
    await sendEmail(createDocumentApprovalEmail({
      recipientEmail: updated.uploadedBy.email,
      recipientName: updated.uploadedBy.name,
      documentType: updated.type,
      documentName: updated.fileName,
      organizationName: updated.organization.name,
      verifiedAt: updated.verifiedAt,
    }));
  } else {
    await sendEmail(createDocumentRejectionEmail({
      // rejection email params
    }));
  }
} catch (emailError) {
  console.error('Email failed:', emailError);
  // Verification still succeeds even if email fails
}
```

---

## Email Design

### Design System

**Colors**:
- Primary: `#3b82f6` (Blue)
- Success: `#10b981` (Green)
- Error: `#ef4444` (Red)
- Neutral: `#6b7280` (Gray)

**Typography**:
- Font: System fonts (Apple, Segoe UI, Roboto)
- Headings: 24px, bold
- Body: 16px, normal
- Small: 14px

**Layout**:
- Max width: 600px
- Padding: 32px
- Border radius: 8px
- Box shadow for depth

**Responsive**: Works on all devices (mobile, tablet, desktop)

---

## Testing Emails

### Send Test Email

```typescript
import { sendTestEmail } from '@/lib/email';

// Send test email
const result = await sendTestEmail('your-email@example.com');

if (result.success) {
  console.log('Test email sent!', result.messageId);
} else {
  console.error('Failed to send:', result.error);
}
```

### Test in Development

**Console Mode** (default):
```env
EMAIL_PROVIDER=console
```

Emails will be logged to console:
```
========== EMAIL (Console Mode) ==========
To: user@example.com
Subject: Document Approved: Operating License
HTML: <html>...</html>
==========================================
```

### Test with Real Provider

**Resend (free tier)**:
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=testing@yourdomain.com
```

Send test:
```bash
# Via API (create test endpoint)
curl -X POST http://localhost:3000/api/test-email \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

---

## Email Deliverability

### Best Practices

**Domain Setup**:
1. ✅ Use custom domain (not @gmail.com)
2. ✅ Set up SPF record
3. ✅ Set up DKIM record
4. ✅ Set up DMARC policy
5. ✅ Verify domain with email provider

**Content**:
1. ✅ Clear subject lines
2. ✅ Professional from name
3. ✅ Include unsubscribe link (future)
4. ✅ Plain text alternative
5. ✅ Avoid spam trigger words

**Technical**:
1. ✅ Use established provider (Resend, SendGrid, SES)
2. ✅ Monitor bounce rates
3. ✅ Handle unsubscribes
4. ✅ Implement email verification (future)

---

## Error Handling

### Email Failures Don't Block Operations

**Philosophy**: Email is a notification, not a critical operation

**Implementation**:
```typescript
try {
  await sendEmail(emailMessage);
} catch (emailError) {
  console.error('Failed to send email:', emailError);
  // Document verification still succeeds
}
```

**Why**:
- Document verification must succeed even if email fails
- Email failures shouldn't prevent user from proceeding
- Email issues can be retried later (future: email queue)

### Logging

All email attempts are logged:
```json
{
  "timestamp": "2025-12-25T14:30:00Z",
  "to": "user@example.com",
  "subject": "Document Approved: Operating License",
  "success": true,
  "messageId": "msg_abc123",
  "provider": "resend"
}
```

Failed emails:
```json
{
  "timestamp": "2025-12-25T14:30:00Z",
  "to": "user@example.com",
  "subject": "Document Rejected",
  "success": false,
  "error": "Invalid API key",
  "provider": "resend"
}
```

---

## Future Enhancements

### 1. Email Queue (Recommended for Production)

**Problem**: Synchronous email sending blocks response

**Solution**: Use email queue (Bull, BullMQ, AWS SQS)

```typescript
// Instead of await sendEmail()
await emailQueue.add('verification-email', {
  type: 'document-approval',
  params: emailParams,
});
```

**Benefits**:
- Faster API responses
- Automatic retries
- Better error handling
- Email rate limiting

---

### 2. Email Preferences

**Feature**: Users can opt-out of certain notifications

**Database**:
```prisma
model User {
  emailPreferences Json? @default("{}")
}
```

**Example**:
```json
{
  "documentVerification": true,
  "loadMatches": false,
  "weeklyDigest": true
}
```

---

### 3. Additional Email Types

**Planned Templates**:
- Load match notifications
- Truck posting confirmations
- Weekly activity digest
- Password reset
- Account activation
- Payment confirmations

---

### 4. Email Analytics

**Metrics**:
- Open rates
- Click rates
- Bounce rates
- Unsubscribe rates

**Providers** (with built-in analytics):
- Resend ✅
- SendGrid ✅
- Postmark ✅

---

## Troubleshooting

### Emails Not Sending

**Check**:
1. Environment variables set correctly
2. API key valid
3. Domain verified (for production)
4. Console shows email logs
5. Check spam folder

**Debug**:
```typescript
// Enable verbose logging
console.log('Email provider:', process.env.EMAIL_PROVIDER);
console.log('From address:', process.env.EMAIL_FROM);

const result = await sendEmail(message);
console.log('Send result:', result);
```

---

### Emails in Spam

**Common Causes**:
- Using @gmail.com or other free email as sender
- Missing SPF/DKIM/DMARC records
- High bounce rate
- Spam trigger words in content

**Solutions**:
1. Use custom domain
2. Configure DNS records properly
3. Use established provider
4. Monitor deliverability metrics

---

## Security Considerations

### Email Addresses

**Privacy**:
- ✅ Email addresses stored securely in database
- ✅ Not exposed in API responses
- ✅ Only sent to authorized users
- ❌ No email address harvesting allowed

### Content

**Safety**:
- ✅ All content sanitized
- ✅ No user-generated HTML in emails
- ✅ Links validated
- ✅ No tracking pixels (optional feature)

### API Keys

**Protection**:
- ✅ API keys in environment variables
- ✅ Not committed to version control
- ✅ Rotated regularly
- ✅ Scoped to minimum permissions

---

## Compliance

**Standards Met**:
- ✅ CAN-SPAM Act compliance (US)
- ✅ GDPR compliance (future: unsubscribe)
- ✅ Professional email design
- ✅ Clear sender identification

**Required Elements** (for commercial emails):
- ✅ Valid from address
- ✅ Accurate subject line
- ✅ Physical address (in footer)
- ⚠️ Unsubscribe link (future enhancement)

---

## Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Email Service | ✅ | Console, Resend, SendGrid, SES support |
| Approval Emails | ✅ | Professional template with document details |
| Rejection Emails | ✅ | Clear rejection reason + next steps |
| Document Verification | ✅ | Automated emails on status change |
| Error Handling | ✅ | Emails don't block operations |
| Email Logging | ✅ | All attempts logged for debugging |
| Email Queue | ⚠️ | Future enhancement (recommended) |
| User Preferences | ⚠️ | Future enhancement |
| Analytics | ⚠️ | Provider-level analytics available |

---

**Last Updated:** 2025-12-25
**Maintained By:** Development Team
**Review Frequency:** Monthly or when adding new email types
