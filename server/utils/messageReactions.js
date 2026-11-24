export const MESSAGE_REACTION_EMOJIS = Object.freeze(['❤️', '👍', '😂', '😮', '😢']);

export function toggleMessageReaction(reactions, userId, emoji) {
  const updated = Array.from(reactions || [], (reaction) => ({
    userId: String(reaction.userId?._id || reaction.userId),
    emoji: reaction.emoji,
  }));
  const current = updated.find((reaction) => reaction.userId === String(userId));

  if (current?.emoji === emoji) {
    return updated.filter((reaction) => reaction.userId !== String(userId));
  }
  if (current) {
    current.emoji = emoji;
    return updated;
  }

  updated.push({ userId: String(userId), emoji });
  return updated;
}
