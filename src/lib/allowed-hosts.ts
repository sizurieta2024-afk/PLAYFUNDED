/**
 * Trusted production hostnames for x-forwarded-host validation.
 * Only these values are accepted when trusting the x-forwarded-host header
 * in OAuth and auth callback routes to prevent host header injection.
 */
export const ALLOWED_FORWARDED_HOSTS = ["playfunded.lat", "www.playfunded.lat"];
