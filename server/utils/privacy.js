export function serializeVisibleUser(user, isContact = false) {
  const result = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  const privacy = result.privacy || {};
  const canSee = (setting = 'everyone') => setting === 'everyone' || (setting === 'contacts' && isContact);
  if (!canSee(privacy.photo)) result.photoURL = '';
  if (!canSee(privacy.lastSeen)) result.lastSeen = null;
  if (!canSee(privacy.online)) result.isOnline = false;
  delete result.privacy;
  delete result.googleId;
  delete result.email;
  delete result.blockedUsers;
  return result;
}
