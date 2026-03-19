import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const isProduction = process.env.NODE_ENV === 'production'

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://js.stripe.com https://sdk.mercadopago.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? '' : ' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*'} https://api.stripe.com https://api.mercadopago.com https://api.nowpayments.io https://api.anthropic.com https://*.supabase.co`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.mercadopago.com https://sdk.mercadopago.com",
  "form-action 'self' https://checkout.stripe.com https://www.mercadopago.com",
  'upgrade-insecure-requests',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
