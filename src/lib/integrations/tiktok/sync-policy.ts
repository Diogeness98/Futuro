export function shouldQueueTikTokOrderEvent(input: {
  initialImport: boolean;
}) {
  return !input.initialImport;
}
