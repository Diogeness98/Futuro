export function shouldQueueTikTokOrderEvent(input: {
  initialImport: boolean;
  orderCreatedEventAt?: Date | null;
}) {
  return !input.initialImport && !input.orderCreatedEventAt;
}
