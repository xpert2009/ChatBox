import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const privacySchema = new Schema({
  lastSeen: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  photo: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  online: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' },
  readReceipts: { type: Boolean, default: true },
}, { _id: false });

const userSettingsSchema = new Schema({
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  notifications: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new Schema({
  googleId: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, unique: true, required: true, lowercase: true },
  photoURL: { type: String, default: '' },
  photoMedia: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
  hasCustomPhoto: { type: Boolean, default: false },
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  bio: { type: String, default: 'Hey! I am using ChatBox', maxlength: 100 },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  privacy: { type: privacySchema, default: () => ({}) },
  settings: { type: userSettingsSchema, default: () => ({}) },
}, { timestamps: true });

const messageFields = {
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'video', 'audio', 'document'], default: 'text' },
  content: { type: String, default: '', maxlength: 10000 },
  fileURL: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  media: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, emoji: String }],
  deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
};

const messageSchema = new Schema({
  ...messageFields,
  receiver: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
}, { timestamps: true });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });

const groupMessageSchema = new Schema({
  ...messageFields,
  replyTo: { type: Schema.Types.ObjectId, ref: 'GroupMessage', default: null },
  group: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
}, { timestamps: true, collection: 'group_messages' });
groupMessageSchema.index({ group: 1, createdAt: -1, _id: -1 });

const groupSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  photoURL: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 250 },
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  onlyAdminCanMessage: { type: Boolean, default: false },
}, { timestamps: true });

const statusSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['image', 'video', 'text'], required: true },
  content: { type: String, default: '' },
  fileURL: { type: String, default: '' },
  media: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
  backgroundColor: { type: String, default: '#075e54' },
  viewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

const mediaSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  secureURL: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'video', 'raw', 'auto'], required: true },
  format: { type: String, default: '' },
  bytes: { type: Number, required: true },
  originalName: { type: String, default: '', maxlength: 200 },
}, { timestamps: true, collection: 'media' });
mediaSchema.index({ owner: 1, createdAt: -1 });

const sessionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'sessions' });

const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  messageId: { type: Schema.Types.ObjectId, required: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
  type: { type: String, enum: ['message', 'group_message'], required: true },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true, collection: 'notifications' });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, deliveredAt: 1 });
notificationSchema.index({ recipient: 1, messageId: 1 }, { unique: true });

const callSchema = new Schema({
  caller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['voice', 'video'], required: true },
  status: { type: String, enum: ['answered', 'missed', 'declined'], default: 'missed' },
  duration: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
}, { timestamps: true });

export const User = models.User || model('User', userSchema);
export const Message = models.Message || model('Message', messageSchema);
export const GroupMessage = models.GroupMessage || model('GroupMessage', groupMessageSchema, 'group_messages');
export const Group = models.Group || model('Group', groupSchema);
export const Status = models.Status || model('Status', statusSchema);
export const Media = models.Media || model('Media', mediaSchema, 'media');
export const Session = models.Session || model('Session', sessionSchema, 'sessions');
export const Notification = models.Notification || model('Notification', notificationSchema, 'notifications');
export const Call = models.Call || model('Call', callSchema);
