function includesUser(userIds, userId) {
  return userIds.some((id) => String(id) === String(userId));
}

export function canViewStatus({
  ownerId,
  viewerId,
  viewerBlockedUsers,
  ownerBlockedUsers,
  isContact,
}) {
  if (String(ownerId) === String(viewerId)) return true;
  return Boolean(isContact) &&
    !includesUser(viewerBlockedUsers, ownerId) &&
    !includesUser(ownerBlockedUsers, viewerId);
}
