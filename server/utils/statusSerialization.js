export function serializeStatus(status) {
  const serialized = status.toObject();
  serialized.viewerCount = serialized.viewers?.length || 0;
  delete serialized.viewers;
  return serialized;
}
