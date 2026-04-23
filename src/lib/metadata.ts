import type { Metadata } from "next";

const DEFAULT_SOCIAL_IMAGE = {
  url: "https://playfunded.lat/opengraph-image",
  width: 1200,
  height: 630,
  alt: "PlayFunded",
};

export function withBrandMetadata(metadata: Metadata): Metadata {
  const openGraph = metadata.openGraph as Record<string, unknown> | undefined;
  const twitter = metadata.twitter as Record<string, unknown> | undefined;

  return {
    ...metadata,
    openGraph: {
      ...openGraph,
      images: openGraph?.images ?? [DEFAULT_SOCIAL_IMAGE],
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      ...twitter,
      images: twitter?.images ?? ["https://playfunded.lat/opengraph-image"],
    } as Metadata["twitter"],
  };
}
