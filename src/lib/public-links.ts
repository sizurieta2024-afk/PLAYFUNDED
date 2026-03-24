function normalizeExternalUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function getDiscordInviteUrl() {
  return normalizeExternalUrl(process.env.NEXT_PUBLIC_DISCORD_INVITE_URL);
}
