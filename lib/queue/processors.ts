/**
 * Queue Job Processors
 *
 * PHASE 4: Background Worker Queue (BullMQ)
 *
 * Processors for different job types:
 * - Email sending
 * - SMS sending
 * - Notifications
 * - Distance matrix calculations
 * - PDF generation
 * - Cleanup tasks
 * - Bulk operations
 */

import { registerProcessor, JobData } from '../queue';
import { logger } from '../logger';

// =============================================================================
// EMAIL PROCESSORS
// =============================================================================

/**
 * Process email send job
 */
async function processEmailSend(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { to, subject, html, text } = job.data as {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
  };

  await updateProgress(10);

  try {
    // Dynamic import to avoid circular dependencies
    const { sendEmail } = await import('../email');

    await updateProgress(30);

    const recipients = Array.isArray(to) ? to : [to];
    for (const recipient of recipients) {
      await sendEmail({
        to: recipient,
        subject,
        html: html || '',
        text,
      });
    }

    await updateProgress(100);

    logger.info('Email sent via queue', {
      jobId: job.id,
      to: recipients.length,
      subject,
    });
  } catch (error) {
    logger.error('Email job failed', error, { jobId: job.id });
    throw error;
  }
}

/**
 * Process bulk email job
 */
async function processEmailBulk(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { emails } = job.data as {
    emails: Array<{
      to: string;
      subject: string;
      html?: string;
      text?: string;
    }>;
  };

  const total = emails.length;
  let processed = 0;

  const { sendEmail } = await import('../email');

  for (const email of emails) {
    try {
      await sendEmail({
        to: email.to,
        subject: email.subject,
        html: email.html || '',
        text: email.text,
      });
    } catch (error) {
      logger.error('Bulk email item failed', error, {
        jobId: job.id,
        to: email.to,
      });
    }

    processed++;
    await updateProgress(Math.round((processed / total) * 100));
  }

  logger.info('Bulk email job completed', {
    jobId: job.id,
    total,
    processed,
  });
}

// =============================================================================
// SMS PROCESSORS
// =============================================================================

/**
 * Process SMS send job
 */
async function processSmsSend(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { to, message, type } = job.data as {
    to: string;
    message: string;
    type?: string;
  };

  await updateProgress(10);

  try {
    const { sendSMS } = await import('../sms/afromessage');

    await updateProgress(30);

    const result = await sendSMS(to, message);

    await updateProgress(100);

    logger.info('SMS sent via queue', {
      jobId: job.id,
      to,
      success: result.success,
    });

    if (!result.success) {
      throw new Error(result.error || 'SMS send failed');
    }
  } catch (error) {
    logger.error('SMS job failed', error, { jobId: job.id });
    throw error;
  }
}

// =============================================================================
// NOTIFICATION PROCESSORS
// =============================================================================

/**
 * Process in-app notification
 */
async function processNotificationCreate(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { userId, type, title, message, metadata } = job.data as {
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  };

  await updateProgress(10);

  try {
    const { createNotification } = await import('../notifications');

    await updateProgress(30);

    await createNotification({
      userId,
      type,
      title,
      message,
      metadata,
    });

    await updateProgress(100);

    logger.info('Notification created via queue', {
      jobId: job.id,
      userId,
      type,
    });
  } catch (error) {
    logger.error('Notification job failed', error, { jobId: job.id });
    throw error;
  }
}

/**
 * Process bulk notifications
 */
async function processNotificationBulk(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { notifications } = job.data as {
    notifications: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    }>;
  };

  const total = notifications.length;
  let processed = 0;

  const { createNotification } = await import('../notifications');

  for (const notification of notifications) {
    try {
      await createNotification(notification);
    } catch (error) {
      logger.error('Bulk notification item failed', error, {
        jobId: job.id,
        userId: notification.userId,
      });
    }

    processed++;
    await updateProgress(Math.round((processed / total) * 100));
  }

  logger.info('Bulk notification job completed', {
    jobId: job.id,
    total,
    processed,
  });
}

// =============================================================================
// DISTANCE MATRIX PROCESSORS
// =============================================================================

/**
 * Process distance matrix calculation
 */
async function processDistanceMatrix(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { pairs, callback } = job.data as {
    pairs: Array<{
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
    }>;
    callback?: string;
  };

  await updateProgress(10);

  try {
    const { batchCalculateDistances } = await import('../googleRoutes');

    await updateProgress(30);

    // Convert pairs to the format expected by batchCalculateDistances
    const requests = pairs.map((pair, index) => ({
      id: `pair_${index}`,
      origin: pair.origin,
      destination: pair.destination,
    }));

    const results = await batchCalculateDistances(requests);

    await updateProgress(90);

    // If callback URL provided, send results
    if (callback) {
      try {
        await fetch(callback, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id, results }),
        });
      } catch (callbackError) {
        logger.warn('Distance matrix callback failed', { jobId: job.id });
      }
    }

    await updateProgress(100);

    logger.info('Distance matrix calculated via queue', {
      jobId: job.id,
      pairs: pairs.length,
    });
  } catch (error) {
    logger.error('Distance matrix job failed', error, { jobId: job.id });
    throw error;
  }
}

// =============================================================================
// PDF PROCESSORS
// =============================================================================

/**
 * Process PDF generation
 */
async function processPdfGenerate(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { template, data, filename, callback } = job.data as {
    template: string;
    data: Record<string, unknown>;
    filename: string;
    callback?: string;
  };

  await updateProgress(10);

  try {
    // PDF generation would use a library like puppeteer or pdfkit
    // This is a placeholder for the actual implementation
    logger.info('PDF generation started', {
      jobId: job.id,
      template,
      filename,
    });

    await updateProgress(50);

    // Simulate PDF generation
    // In production, this would render HTML template and convert to PDF
    const pdfBuffer = Buffer.from('PDF placeholder content');

    await updateProgress(80);

    // Upload to storage if needed
    // const { uploadFile } = await import('../storage');
    // const url = await uploadFile(pdfBuffer, `pdfs/${filename}`, 'application/pdf');

    await updateProgress(100);

    logger.info('PDF generated via queue', {
      jobId: job.id,
      filename,
    });
  } catch (error) {
    logger.error('PDF generation job failed', error, { jobId: job.id });
    throw error;
  }
}

// =============================================================================
// CLEANUP PROCESSORS
// =============================================================================

/**
 * Process expired loads cleanup
 */
async function processCleanupExpiredLoads(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  await updateProgress(10);

  try {
    const { db } = await import('../db');

    await updateProgress(30);

    // Find and update expired loads
    const result = await db.load.updateMany({
      where: {
        status: 'POSTED',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    await updateProgress(100);

    logger.info('Expired loads cleanup completed', {
      jobId: job.id,
      count: result.count,
    });
  } catch (error) {
    logger.error('Cleanup job failed', error, { jobId: job.id });
    throw error;
  }
}

/**
 * Process expired truck postings cleanup
 */
async function processCleanupExpiredPostings(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  await updateProgress(10);

  try {
    const { db } = await import('../db');

    await updateProgress(30);

    const result = await db.truckPosting.updateMany({
      where: {
        status: 'ACTIVE',
        availableTo: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    await updateProgress(100);

    logger.info('Expired postings cleanup completed', {
      jobId: job.id,
      count: result.count,
    });
  } catch (error) {
    logger.error('Cleanup job failed', error, { jobId: job.id });
    throw error;
  }
}

/**
 * Process GPS data cleanup
 */
async function processCleanupGpsData(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { retentionDays = 90 } = job.data as { retentionDays?: number };

  await updateProgress(10);

  try {
    const { db } = await import('../db');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await updateProgress(30);

    const result = await db.gpsPosition.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    await updateProgress(100);

    logger.info('GPS data cleanup completed', {
      jobId: job.id,
      deleted: result.count,
      retentionDays,
    });
  } catch (error) {
    logger.error('GPS cleanup job failed', error, { jobId: job.id });
    throw error;
  }
}

// =============================================================================
// BULK OPERATION PROCESSORS
// =============================================================================

/**
 * Process bulk status update
 */
async function processBulkStatusUpdate(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  const { model, ids, status, isAvailable, updatedBy } = job.data as {
    model: 'load' | 'truck' | 'user' | 'truckPosting';
    ids: string[];
    status?: string;
    isAvailable?: boolean;
    updatedBy: string;
  };

  const total = ids.length;
  let processed = 0;

  const { db } = await import('../db');

  for (const id of ids) {
    try {
      switch (model) {
        case 'load':
          if (status) {
            await db.load.update({ where: { id }, data: { status: status as any } });
          }
          break;
        case 'truck':
          // Trucks use isAvailable boolean instead of status
          if (isAvailable !== undefined) {
            await db.truck.update({ where: { id }, data: { isAvailable } });
          }
          break;
        case 'truckPosting':
          if (status) {
            await db.truckPosting.update({ where: { id }, data: { status: status as any } });
          }
          break;
        case 'user':
          if (status) {
            await db.user.update({ where: { id }, data: { status: status as any } });
          }
          break;
      }
    } catch (error) {
      logger.error('Bulk update item failed', error, {
        jobId: job.id,
        model,
        id,
      });
    }

    processed++;
    await updateProgress(Math.round((processed / total) * 100));
  }

  logger.info('Bulk status update completed', {
    jobId: job.id,
    model,
    total,
    processed,
  });
}

// =============================================================================
// SCHEDULED JOB PROCESSORS
// =============================================================================

/**
 * Process auto-settlement job
 * Note: Full settlement logic will be implemented when payment integration is added.
 * For now, this logs delivered loads that would be candidates for settlement.
 */
async function processAutoSettle(
  job: { id: string; name: string; data: JobData },
  updateProgress: (progress: number) => Promise<void>
): Promise<void> {
  await updateProgress(10);

  try {
    const { db } = await import('../db');

    // Find delivered loads that could be candidates for settlement
    // Note: podStatus and settlementStatus fields will be added in future sprints
    const deliveredLoads = await db.load.findMany({
      where: {
        status: 'DELIVERED',
      },
      take: 100,
      select: {
        id: true,
        status: true,
        deliveryDate: true,
      },
    });

    await updateProgress(50);

    // Log candidates for future settlement processing
    // Actual settlement logic will be added when payment integration is implemented
    logger.info('Auto-settlement candidates identified', {
      jobId: job.id,
      candidateCount: deliveredLoads.length,
    });

    await updateProgress(100);

    logger.info('Auto-settlement job completed', {
      jobId: job.id,
      found: deliveredLoads.length,
      note: 'Settlement logic pending payment integration',
    });
  } catch (error) {
    logger.error('Auto-settlement job failed', error, { jobId: job.id });
    throw error;
  }
}

// =============================================================================
// REGISTER ALL PROCESSORS
// =============================================================================

export function registerAllProcessors(): void {
  // Email processors
  registerProcessor('email', 'send', processEmailSend);
  registerProcessor('email', 'bulk', processEmailBulk);

  // SMS processors
  registerProcessor('sms', 'send', processSmsSend);

  // Notification processors
  registerProcessor('notifications', 'create', processNotificationCreate);
  registerProcessor('notifications', 'bulk', processNotificationBulk);

  // Distance matrix processors
  registerProcessor('distance-matrix', 'calculate', processDistanceMatrix);

  // PDF processors
  registerProcessor('pdf', 'generate', processPdfGenerate);

  // Cleanup processors
  registerProcessor('cleanup', 'expire-loads', processCleanupExpiredLoads);
  registerProcessor('cleanup', 'expire-postings', processCleanupExpiredPostings);
  registerProcessor('cleanup', 'gps-data', processCleanupGpsData);

  // Bulk operation processors
  registerProcessor('bulk', 'status-update', processBulkStatusUpdate);

  // Scheduled job processors
  registerProcessor('scheduled', 'auto-settle', processAutoSettle);

  logger.info('All queue processors registered');
}

export default {
  registerAllProcessors,
};
