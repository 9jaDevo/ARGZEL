import { Schema, type Types } from 'mongoose';
import { defineModel } from './define';
import type { ApiUser } from '@/types/api';

export interface UserAttrs {
  name: string;
  email: string;
  password_hash: string;
  timezone: string;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<UserAttrs>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true, select: false },
    timezone: { type: String, required: true, default: 'UTC' },
    onboarding_completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

export const User = defineModel<UserAttrs>('User', userSchema, 'users');

export function toApiUser(user: UserAttrs & { _id: Types.ObjectId }): ApiUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    onboarding_completed: user.onboarding_completed,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}
