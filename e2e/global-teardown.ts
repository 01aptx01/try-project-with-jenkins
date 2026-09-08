import { stopE2EStack } from "./support/stack-launcher.js";

export default async function globalTeardown(): Promise<void> {
  await stopE2EStack();
}
