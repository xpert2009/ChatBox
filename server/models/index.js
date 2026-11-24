import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const privacySchema = new Schema({
  lastSeen: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  photo: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
  online: { type: String, enum: ['everyone', 'nobody'], default: 'everyone' },
  readReceipts: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new Schema({
  googleId: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, unique: true, required: true, lowercase: true },
  photoURL: { type: String, default: '' },
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  bio: { type: String, default: 'Hey! I am using ChatBox', maxlength: 100 },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  privacy: { type: privacySchema, default: () => ({}) },
}, { timestamps: true });

const messageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  type: { type: String, enum: ['text', 'image', 'video', 'audio', 'document'], default: 'text' },
  content: { type: String, default: '', maxlength: 10000 },
  fileURL: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  reactions: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, emoji: String }],
  deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });

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
  backgroundColor: { type: String, default: '#075e54' },
  viewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

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
export const Group = models.Group || model('Group', groupSchema);
export const Status = models.Status || model('Status', statusSchema);
export const Call = models.Call || model('Call', callSchema);
