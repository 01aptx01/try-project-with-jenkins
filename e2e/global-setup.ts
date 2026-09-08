import { startE2EStack } from "./support/stack-launcher.js";

export default async function globalSetup(): Promise<void> {
  await startE2EStack();
}
