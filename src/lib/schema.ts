const BASE_URL = "https://playfunded.lat";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "FinancialService"],
    "@id": `${BASE_URL}/#organization`,
    name: "PlayFunded",
    legalName: "PlayFunded",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    image: `${BASE_URL}/og-image.png`,
    description:
      "PlayFunded es la primera prop firm de trading deportivo de América Latina. Los traders pagan una tarifa única de entrada, completan dos fases de evaluación con fondos simulados y obtienen una cuenta financiada con hasta 80% de reparto de ganancias.",
    slogan: "Nuestro riesgo, tus ganancias",
    foundingDate: "2025",
    knowsLanguage: ["es", "pt", "en"],
    priceRange: "$19.99–$249.99",
    currenciesAccepted: "USD, MXN, BRL, ARS, COP, CLP, PEN",
    paymentAccepted: "Credit Card, Debit Card, Pix, Cryptocurrency",
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
      url: `${BASE_URL}/contact`,
      availableLanguage: ["Spanish", "Portuguese", "English"],
    },
    sameAs: [
      "https://twitter.com/playfunded",
      "https://www.instagram.com/playfunded",
      "https://www.tiktok.com/@playfunded",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Desafíos de trading deportivo",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Desafío Starter",
          description:
            "Cuenta de $500 en bankroll simulado. Ideal para comenzar.",
          priceCurrency: "USD",
          price: "19.99",
        },
        {
          "@type": "Offer",
          name: "Desafío Pro",
          description:
            "Cuenta de $2,500 en bankroll simulado con 80% de reparto.",
          priceCurrency: "USD",
          price: "49.99",
        },
        {
          "@type": "Offer",
          name: "Desafío Elite",
          description: "Cuenta de $5,000 en bankroll simulado. El más popular.",
          priceCurrency: "USD",
          price: "99.99",
        },
        {
          "@type": "Offer",
          name: "Desafío Legend",
          description: "Cuenta de $25,000 en bankroll simulado.",
          priceCurrency: "USD",
          price: "249.99",
        },
      ],
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    name: "PlayFunded",
    alternateName: ["Play Funded", "PlayFunded LATAM", "PlayFunded prop firm"],
    url: BASE_URL,
    description:
      "La primera prop firm de trading deportivo para América Latina. Demuestra tu talento, supera las fases y obtén una cuenta financiada con hasta 80% de reparto de ganancias.",
    inLanguage: ["es-419", "pt-BR", "en"],
    publisher: { "@id": `${BASE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/challenges?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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

export function homeFaqSchema(locale: string) {
  const faqs: Record<string, Array<{ question: string; answer: string }>> = {
    "es-419": [
      {
        question: "¿Qué es PlayFunded?",
        answer:
          "PlayFunded es la primera prop firm de trading deportivo de América Latina. Pagas una tarifa de entrada única (desde $19.99), superas dos fases de evaluación con fondos simulados y obtienes una cuenta financiada real con hasta 80% de reparto de ganancias. Sin riesgo de capital propio.",
      },
      {
        question: "¿Cómo funciona el desafío de dos fases?",
        answer:
          "En la Fase 1 necesitas alcanzar +20% de ganancias con mínimo 15 picks. En la Fase 2 repites el proceso. Al superar ambas fases, recibes una cuenta financiada real. Las reglas de riesgo incluyen un límite de drawdown del 15% y pérdida diaria máxima del 10%.",
      },
      {
        question: "¿Cuánto dinero puedo ganar con PlayFunded?",
        answer:
          "Los traders financiados reciben hasta el 80% de todas las ganancias. Ofrecemos cuentas desde $500 hasta $25,000 en bankroll simulado durante la evaluación. Una vez financiado, operas con capital real de PlayFunded y cobras mensualmente.",
      },
      {
        question: "¿Qué deportes y ligas están disponibles?",
        answer:
          "PlayFunded cubre Fútbol (Liga MX, Premier League, LaLiga, Champions League), Baloncesto (NBA, WNBA), NFL, Tenis y MMA (UFC). Estamos expandiendo continuamente la oferta de ligas y deportes disponibles.",
      },
      {
        question: "¿Es PlayFunded legítimo y seguro?",
        answer:
          "Sí. PlayFunded opera con fondos simulados durante la evaluación, por lo que nunca arriesgas más que tu tarifa de entrada. Somos la alternativa latinoamericana confiable al mercado anglosajón de prop firms deportivos, con reglas transparentes y pagos reales mensuales.",
      },
      {
        question: "¿Cuál es la diferencia entre PlayFunded y playfunded.com?",
        answer:
          "PlayFunded (playfunded.lat) es la plataforma original de prop trading deportivo para América Latina, fundada en 2025. Operamos en español, portugués e inglés, con soporte para tarjetas, Pix y criptomonedas según la disponibilidad de tu mercado.",
      },
    ],
    en: [
      {
        question: "What is PlayFunded?",
        answer:
          "PlayFunded is the first sports prop trading firm built for Latin America. You pay a one-time entry fee (from $19.99), complete two evaluation phases using simulated funds, and earn a real funded account with up to 80% profit split. You never risk more than your entry fee.",
      },
      {
        question: "How does the two-phase challenge work?",
        answer:
          "Phase 1 requires you to reach +20% profit with a minimum of 15 picks. Phase 2 repeats the same criteria. Pass both phases and you receive a fully funded trading account. Risk rules include a 15% max drawdown limit and 10% daily loss limit.",
      },
      {
        question: "How much can I earn with PlayFunded?",
        answer:
          "Funded traders keep up to 80% of all profits. We offer accounts from $500 up to $25,000 in simulated bankroll during evaluation. Once funded, you trade with real PlayFunded capital and receive monthly payouts.",
      },
      {
        question: "Which sports and leagues are available?",
        answer:
          "PlayFunded covers Soccer (Liga MX, Premier League, LaLiga, Champions League), Basketball (NBA, WNBA), NFL, Tennis, and MMA (UFC). More leagues and sports are being added continuously.",
      },
      {
        question: "Is PlayFunded legitimate and safe?",
        answer:
          "Yes. PlayFunded uses simulated funds during evaluation, meaning you never risk more than your entry fee. We are the trusted Latin American alternative to English-language prop trading firms, with transparent rules and real monthly payouts.",
      },
    ],
    "pt-BR": [
      {
        question: "O que é PlayFunded?",
        answer:
          "PlayFunded é a primeira prop firm de trading esportivo construída para a América Latina. Você paga uma taxa de entrada única (a partir de $19,99), completa duas fases de avaliação com fundos simulados e obtém uma conta financiada real com até 80% de divisão de lucros.",
      },
      {
        question: "Como funciona o desafio de duas fases?",
        answer:
          "Na Fase 1, você precisa atingir +20% de lucro com no mínimo 15 picks. A Fase 2 repete os mesmos critérios. Supere as duas fases e receba uma conta de trading totalmente financiada. As regras de risco incluem limite de drawdown de 15% e perda diária de 10%.",
      },
      {
        question: "Quanto posso ganhar com PlayFunded?",
        answer:
          "Traders financiados ficam com até 80% de todos os lucros. Oferecemos contas de $500 a $25.000 em bankroll simulado durante a avaliação. Uma vez financiado, você opera com capital real da PlayFunded e recebe pagamentos mensais.",
      },
      {
        question: "Quais esportes e ligas estão disponíveis?",
        answer:
          "A PlayFunded cobre Futebol (Brasileirão, Premier League, LaLiga, Champions League), Basquete (NBA, WNBA), NFL, Tênis e MMA (UFC). Mais ligas e esportes são adicionados continuamente.",
      },
      {
        question: "A PlayFunded é legítima e segura?",
        answer:
          "Sim. A PlayFunded usa fundos simulados durante a avaliação, o que significa que você nunca arrisca mais do que sua taxa de entrada. Somos a alternativa latino-americana confiável às prop firms do mercado anglófono, com regras transparentes e pagamentos mensais reais.",
      },
    ],
  };
  return faqPageSchema(faqs[locale] ?? faqs["es-419"]);
}
