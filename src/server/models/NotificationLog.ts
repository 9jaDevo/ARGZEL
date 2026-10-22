import { Schema, type Types } from 'mongoose';
import { defineModel } from './define';
import { DELIVERY_CHANNELS, type DeliveryChannel } from './Reminder';

// One row per delivery attempt. Written by the email scheduler (Phase 7).
export const NOTIFICATION_STATUSES = ['sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface NotificationLogAttrs {
  reminder_id: Types.ObjectId;
  channel: DeliveryChannel;
  attempted_at: Date;
  status: NotificationStatus;
  /** Provider message id or error summary. Never store email bodies or secrets here. */
  provider_response: string;
}

const notificationLogSchema = new Schema<NotificationLogAttrs>(
  {
    reminder_id: { type: Schema.Types.ObjectId, ref: 'Reminder', required: true },
    channel: { type: String, enum: DELIVERY_CHANNELS, required: true },
    attempted_at: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: NOTIFICATION_STATUSES, required: true },
    provider_response: { type: String, default: '', maxlength: 2000 },
  },
  { versionKey: false },
);

notificationLogSchema.index({ reminder_id: 1, attempted_at: -1 });

export const NotificationLog = defineModel<NotificationLogAttrs>('NotificationLog', notificationLogSchema, 'notification_logs');
