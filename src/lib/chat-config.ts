export function isChatConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
