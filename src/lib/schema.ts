export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://playfunded.lat/#organization",
    name: "PlayFunded",
    url: "https://playfunded.lat",
    logo: {
      "@type": "ImageObject",
      url: "https://playfunded.lat/logo.png",
    },
    description:
      "PlayFunded is the first sports prop trading challenge platform built for Latin America. Traders pay a one-time entry fee, complete two evaluation phases using simulated funds, and earn a funded account with profit splits up to 80%.",
    slogan: "Nuestro riesgo, tus ganancias",
    foundingDate: "2025",
    knowsLanguage: ["es", "pt", "en"],
    areaServed: [
      { "@type": "Country", name: "Mexico" },
      { "@type": "Country", name: "Brazil" },
      { "@type": "Country", name: "Argentina" },
      { "@type": "Country", name: "Colombia" },
      { "@type": "Country", name: "Chile" },
      { "@type": "Country", name: "Peru" },
      { "@type": "Country", name: "Ecuador" },
      { "@type": "Country", name: "Uruguay" },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://playfunded.lat/contact",
      availableLanguage: ["Spanish", "Portuguese", "English"],
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://playfunded.lat/#website",
    name: "PlayFunded",
    url: "https://playfunded.lat",
    description:
      "La primera plataforma de trading deportivo para América Latina. Demuestra tu talento, supera las fases y obtén una cuenta financiada.",
    inLanguage: ["es-419", "pt-BR", "en"],
    publisher: { "@id": "https://playfunded.lat/#organization" },
  };
}

export function faqPageSchema(
  questions: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}
