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
          "/auth/login",
          "/auth/signup",
          "/auth/verify",
          "/auth/forgot-password",
          "/auth/reset-password",
          "/auth/callback",
          "/redeem",
          "/en/dashboard",
          "/en/admin",
          "/en/checkout",
          "/en/auth/login",
          "/en/auth/signup",
          "/en/auth/verify",
          "/en/auth/forgot-password",
          "/en/auth/reset-password",
          "/en/redeem",
          "/pt-BR/dashboard",
          "/pt-BR/admin",
          "/pt-BR/checkout",
          "/pt-BR/auth/login",
          "/pt-BR/auth/signup",
          "/pt-BR/auth/verify",
          "/pt-BR/auth/forgot-password",
          "/pt-BR/auth/reset-password",
          "/pt-BR/redeem",
        ],
      },
    ],
    sitemap: "https://playfunded.lat/sitemap.xml",
    host: "https://playfunded.lat",
  };
}
