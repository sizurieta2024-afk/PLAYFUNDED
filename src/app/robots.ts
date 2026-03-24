import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/checkout",
          "/auth",
          "/redeem",
          "/en/dashboard",
          "/en/admin",
          "/en/checkout",
          "/en/auth",
          "/en/redeem",
          "/pt-BR/dashboard",
          "/pt-BR/admin",
          "/pt-BR/checkout",
          "/pt-BR/auth",
          "/pt-BR/redeem",
        ],
      },
    ],
    sitemap: "https://playfunded.lat/sitemap.xml",
    host: "https://playfunded.lat",
  };
}
