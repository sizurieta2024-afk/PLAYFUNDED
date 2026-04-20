import nodemailer from "nodemailer";
import { getCanonicalAppUrl } from "@/lib/public-origin";

const FROM = process.env.SMTP_FROM?.trim() || "noreply@playfunded.lat";
const APP_URL = getCanonicalAppUrl();

// next-intl uses localePrefix:"as-needed" — the default locale (es-419) has no
// prefix at all. Other locales get their code prepended.
const DEFAULT_LOCALE = "es-419";
function localeUrl(locale: string, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  return `${APP_URL}${prefix}${path}`;
}

// ── Base HTML wrapper ────────────────────────────────────────────────────────
function wrap(body: string, locale = "es-419"): string {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const footerText = isEs
    ? "PlayFunded · La plataforma de trading deportivo para América Latina"
    : isPt
      ? "PlayFunded · A plataforma de trading esportivo para a América Latina"
      : "PlayFunded · The sports prop trading platform for Latin America";
  const manageText = isEs
    ? "Gestionar notificaciones"
    : isPt
      ? "Gerenciar notificações"
      : "Manage notifications";

  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5}
  .wrap{max-width:560px;margin:32px auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden}
  .header{background:#c9a84c;padding:24px 32px}
  .header h1{margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px}
  .header p{margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)}
  .body{padding:28px 32px;line-height:1.6}
  .body h2{margin:0 0 12px;font-size:16px;font-weight:600;color:#f5f5f5}
  .body p{margin:0 0 16px;font-size:14px;color:#a3a3a3}
  .stat{display:inline-block;background:#1f1f1f;border:1px solid #2a2a2a;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
  .stat .val{font-size:20px;font-weight:700;color:#c9a84c}
  .stat .lbl{font-size:11px;color:#737373;margin-top:2px}
  .btn{display:inline-block;margin:8px 0;padding:12px 24px;background:#ff2d78;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600}
  .footer{padding:16px 32px;border-top:1px solid #262626}
  .footer p{margin:0;font-size:11px;color:#525252;text-align:center}
  .tag{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
  .tag-brand{background:#c9a84c22;color:#c9a84c}
  .tag-red{background:#dc262622;color:#f87171}
  .tag-yellow{background:#ca8a0422;color:#fbbf24}
  hr{border:none;border-top:1px solid #262626;margin:20px 0}
</style></head><body>
<div class="wrap">${body}
<div class="footer"><p>${footerText}<br/>
<a href="${localeUrl(locale, "/dashboard/settings")}" style="color:#525252">${manageText}</a></p></div>
</div></body></html>`;
}

function header(title: string, sub?: string) {
  return `<div class="header"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
}

// ── SMTP transporter (lazy-initialized) ──────────────────────────────────────
function createTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_APP_PASSWORD?.trim();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL
    auth: { user, pass },
  });
}

// Strip HTML tags to generate a plain-text fallback (required for deliverability)
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Send helper ──────────────────────────────────────────────────────────────
async function deliverEmail(
  to: string,
  subject: string,
  html: string,
  required = false,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    if (required) {
      throw new Error("SMTP transport is not configured");
    }
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: htmlToText(html), // plain-text fallback required by Gmail / spam filters
      headers: {
        // Unique ID prevents Gmail from threading unrelated emails together
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  } catch (err) {
    console.error("[email] send failed:", to, subject, err);
    if (required) {
      throw err;
    }
    // Never throw — best-effort email failure must not break the main flow
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await deliverEmail(to, subject, html, false);
}

export async function sendRequiredEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await deliverEmail(to, subject, html, true);
}

// ── 0. Email Verification ────────────────────────────────────────────────────
export function verificationEmail(
  name: string | null,
  actionLink: string,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? (isEs ? "trader" : isPt ? "trader" : "trader");

  const subject = isEs
    ? "Confirma tu email para activar tu cuenta"
    : isPt
      ? "Confirme seu e-mail para ativar sua conta"
      : "Confirm your email to activate your account";

  const headerTitle = isEs
    ? "Activa tu cuenta"
    : isPt
      ? "Ative sua conta"
      : "Activate your account";

  const headerSub = isEs
    ? "Verifica que este email es realmente tuyo."
    : isPt
      ? "Confirme que este e-mail realmente é seu."
      : "Verify that this email address really belongs to you.";

  const intro = isEs
    ? `Hola ${n}, ya casi está listo. Confirma tu email para activar tu cuenta y entrar a PlayFunded.`
    : isPt
      ? `Olá ${n}, está quase pronto. Confirme seu e-mail para ativar sua conta e entrar na PlayFunded.`
      : `Hey ${n}, you're almost there. Confirm your email to activate your account and access PlayFunded.`;

  const button = isEs
    ? "Confirmar email →"
    : isPt
      ? "Confirmar e-mail →"
      : "Confirm email →";

  const footer = isEs
    ? "Si no creaste esta cuenta, puedes ignorar este correo."
    : isPt
      ? "Se você não criou esta conta, pode ignorar este e-mail."
      : "If you did not create this account, you can ignore this email.";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, headerSub)}
      <div class="body">
        <h2>${intro}</h2>
        <p>
          ${
            isEs
              ? "Por seguridad, no activamos el acceso hasta que confirmes el enlace enviado a este correo."
              : isPt
                ? "Por segurança, não ativamos o acesso até que você confirme o link enviado para este e-mail."
                : "For security, we do not activate access until you confirm the link sent to this email address."
          }
        </p>
        <a href="${actionLink}" class="btn">${button}</a>
        <hr/>
        <p>${footer}</p>
      </div>`,
      locale,
    ),
  };
}

export function passwordResetEmail(
  name: string | null,
  actionLink: string,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? (isEs ? "trader" : isPt ? "trader" : "trader");

  const subject = isEs
    ? "Restablece tu contraseña de PlayFunded"
    : isPt
      ? "Redefina sua senha da PlayFunded"
      : "Reset your PlayFunded password";

  const headerTitle = isEs
    ? "Restablece tu contraseña"
    : isPt
      ? "Redefina sua senha"
      : "Reset your password";

  const headerSub = isEs
    ? "Usa este enlace para crear una contraseña nueva."
    : isPt
      ? "Use este link para criar uma nova senha."
      : "Use this link to create a new password.";

  const intro = isEs
    ? `Hola ${n}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`
    : isPt
      ? `Olá ${n}, recebemos uma solicitação para alterar a senha da sua conta.`
      : `Hey ${n}, we received a request to change the password for your account.`;

  const body = isEs
    ? "Si fuiste tú, usa el botón de abajo para establecer una contraseña nueva. Si no solicitaste este cambio, puedes ignorar este correo."
    : isPt
      ? "Se foi você, use o botão abaixo para definir uma nova senha. Se não solicitou essa alteração, pode ignorar este e-mail."
      : "If this was you, use the button below to set a new password. If you did not request this change, you can ignore this email.";

  const button = isEs
    ? "Crear nueva contraseña →"
    : isPt
      ? "Criar nova senha →"
      : "Create new password →";

  const footer = isEs
    ? "Por seguridad, este enlace debe usarse desde una ventana reciente de PlayFunded."
    : isPt
      ? "Por segurança, este link deve ser usado a partir de uma janela recente da PlayFunded."
      : "For security, this link should be used from a recent PlayFunded session.";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, headerSub)}
      <div class="body">
        <h2>${intro}</h2>
        <p>${body}</p>
        <a href="${actionLink}" class="btn">${button}</a>
        <hr/>
        <p>${footer}</p>
      </div>`,
      locale,
    ),
  };
}

// ── 1. Welcome ───────────────────────────────────────────────────────────────
export function welcomeEmail(
  name: string | null,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? (isEs ? "ahí" : isPt ? "aí" : "there");

  const subject = isEs
    ? "Bienvenido a PlayFunded 🎯"
    : isPt
      ? "Bem-vindo ao PlayFunded 🎯"
      : "Welcome to PlayFunded 🎯";

  const h2 = isEs
    ? `¡Hola ${n}, ya estás adentro!`
    : isPt
      ? `Olá ${n}, você está dentro!`
      : `Hey ${n}, you're in!`;

  const body = isEs
    ? "PlayFunded es la plataforma de trading deportivo de América Latina. Demuestra tu habilidad en dos fases y obtén una cuenta fondeada — nosotros ponemos el capital, tú te quedas hasta el 80% de las ganancias."
    : isPt
      ? "PlayFunded é a plataforma de trading esportivo da América Latina. Prove sua habilidade em duas fases e ganhe uma conta financiada — nós colocamos o capital, você fica com até 80% dos lucros."
      : "PlayFunded is Latin America's sports trading platform. Prove your skill across two phases and earn a funded account — we put up the capital, you keep up to 80% of the profits.";

  const steps = isEs
    ? `1️⃣ Explora nuestros desafíos<br/>
           2️⃣ Compra un desafío (desde $19.99)<br/>
           3️⃣ Alcanza el objetivo en Fase 1 (+20%), luego Fase 2 (+20%)<br/>
           4️⃣ Obtén tu cuenta fondeada y empieza a ganar`
    : isPt
      ? `1️⃣ Explore nossos desafios<br/>
           2️⃣ Compre um desafio (a partir de $19.99)<br/>
           3️⃣ Atinja a meta na Fase 1 (+20%), depois Fase 2 (+20%)<br/>
           4️⃣ Seja financiado e comece a ganhar`
      : `1️⃣ Browse our challenge tiers<br/>
           2️⃣ Purchase a challenge (entry fees start at $19.99)<br/>
           3️⃣ Hit the profit target in Phase 1 (+20%), then Phase 2 (+20%)<br/>
           4️⃣ Get funded and start earning real payouts`;

  const cta = isEs
    ? "Ver Desafíos →"
    : isPt
      ? "Ver Desafios →"
      : "Browse Challenges →";

  const faqText = isEs
    ? "Preguntas Frecuentes"
    : isPt
      ? "Perguntas Frequentes"
      : "FAQ";

  const headerTitle = isEs
    ? "Bienvenido a PlayFunded"
    : isPt
      ? "Bem-vindo ao PlayFunded"
      : "Welcome to PlayFunded";

  const headerSub = isEs
    ? "Ponemos el riesgo, tú te llevas las ganancias"
    : isPt
      ? "Assumimos o risco, você fica com os ganhos"
      : "We put the risk, you get the wins";

  const questionsText = isEs
    ? "¿Preguntas? Responde este correo o visita nuestras"
    : isPt
      ? "Dúvidas? Responda este e-mail ou visite nossas"
      : "Questions? Just reply to this email or visit our";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, headerSub)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${body}</p>
        <p>${isEs ? "Cómo empezar:" : isPt ? "Como começar:" : "Here's how to get started:"}</p>
        <p>${steps}</p>
        <a href="${localeUrl(locale, "/challenges")}" class="btn">${cta}</a>
        <hr/>
        <p>${questionsText} <a href="${localeUrl(locale, "/faq")}" style="color:#c9a84c">${faqText}</a>.</p>
      </div>`,
      locale,
    ),
  };
}

// ── 2. Challenge Purchased ───────────────────────────────────────────────────
export function challengePurchasedEmail(
  name: string | null,
  tierName: string,
  bankroll: number,
  minPicks = 15,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? (isEs ? "Trader" : isPt ? "Trader" : "Trader");
  const bal = `$${(bankroll / 100).toLocaleString("en-US")}`;

  const subject = isEs
    ? `Desafío activado — ${tierName}`
    : isPt
      ? `Desafio ativado — ${tierName}`
      : `Challenge activated — ${tierName}`;

  const headerTitle = isEs
    ? "¡Tu desafío está activo!"
    : isPt
      ? "Seu desafio está ativo!"
      : "Your challenge is live!";

  const h2 = isEs
    ? `Buena suerte, ${n}.`
    : isPt
      ? `Boa sorte, ${n}.`
      : `Good luck, ${n}.`;

  const bodyText = isEs
    ? `Tu desafío <strong>${tierName}</strong> ha sido activado con un bankroll simulado de <strong>${bal}</strong>.`
    : isPt
      ? `Seu desafio <strong>${tierName}</strong> foi ativado com um bankroll simulado de <strong>${bal}</strong>.`
      : `Your <strong>${tierName}</strong> challenge has been activated with a <strong>${bal}</strong> simulated bankroll.`;

  const lbl1 = isEs
    ? "Objetivo Fase 1"
    : isPt
      ? "Meta Fase 1"
      : "Phase 1 target";
  const lbl2 = isEs
    ? "Objetivo Fase 2"
    : isPt
      ? "Meta Fase 2"
      : "Phase 2 target";
  const lbl3 = isEs
    ? "Picks mínimos/fase"
    : isPt
      ? "Picks mínimos/fase"
      : "Min picks/phase";
  const lbl4 = isEs
    ? "Pérdida diaria máx."
    : isPt
      ? "Perda diária máx."
      : "Daily loss limit";

  const cta = isEs
    ? "Ir al Dashboard →"
    : isPt
      ? "Ir ao Dashboard →"
      : "Go to Dashboard →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, `${tierName} · ${bal} bankroll`)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <div>
          <div class="stat"><div class="val">+20%</div><div class="lbl">${lbl1}</div></div>
          <div class="stat"><div class="val">+20%</div><div class="lbl">${lbl2}</div></div>
          <div class="stat"><div class="val">${minPicks}</div><div class="lbl">${lbl3}</div></div>
          <div class="stat"><div class="val">−10%</div><div class="lbl">${lbl4}</div></div>
        </div>
        <hr/>
        <a href="${localeUrl(locale, "/dashboard")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 3. Phase 1 Passed ────────────────────────────────────────────────────────
export function phase1PassedEmail(
  name: string | null,
  tierName: string,
  minPicks = 15,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";

  const subject = isEs
    ? "Fase 1 superada — comienza la Fase 2 🚀"
    : isPt
      ? "Fase 1 concluída — Fase 2 começando 🚀"
      : "Phase 1 passed — Phase 2 is starting 🚀";

  const headerTitle = isEs
    ? "¡Fase 1 completada!"
    : isPt
      ? "Fase 1 completa!"
      : "Phase 1 complete!";

  const headerSub = isEs
    ? "Ya estás a mitad de camino."
    : isPt
      ? "Você está na metade do caminho."
      : "You're halfway to funded.";

  const h2 = isEs
    ? `¡Trabajo increíble, ${n}!`
    : isPt
      ? `Incrível, ${n}!`
      : `Incredible work, ${n}!`;

  const bodyText = isEs
    ? `Has superado la <strong>Fase 1</strong> de tu desafío <strong>${tierName}</strong>. La Fase 2 ha comenzado automáticamente.`
    : isPt
      ? `Você passou a <strong>Fase 1</strong> do seu desafio <strong>${tierName}</strong>. A Fase 2 começou automaticamente.`
      : `You've passed <strong>Phase 1</strong> of your <strong>${tierName}</strong> challenge. Phase 2 has now started automatically.`;

  const details = isEs
    ? `<strong>Objetivo Fase 2:</strong> alcanza +20% de ganancia desde tu balance inicial de Fase 2 en un mínimo de ${minPicks} picks.`
    : isPt
      ? `<strong>Meta Fase 2:</strong> alcance +20% de lucro a partir do seu saldo inicial da Fase 2 em um mínimo de ${minPicks} picks.`
      : `<strong>Phase 2 target:</strong> reach +20% profit from your Phase 2 starting balance in a minimum of ${minPicks} picks.`;

  const tip = isEs
    ? "Mantén la misma disciplina — cuida tu pérdida diaria y el drawdown. Ya casi lo logras."
    : isPt
      ? "Mantenha a mesma disciplina — observe seu limite de perda diária e o drawdown. Você está quase lá."
      : "Keep the same discipline — watch your daily loss limit and drawdown. You're almost there.";

  const cta = isEs
    ? "Seguir Operando →"
    : isPt
      ? "Continuar Operando →"
      : "Continue Trading →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, headerSub)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <p>${details}</p>
        <p>${tip}</p>
        <a href="${localeUrl(locale, "/dashboard")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 4. Funded ────────────────────────────────────────────────────────────────
export function fundedEmail(
  name: string | null,
  tierName: string,
  bankroll: number,
  splitPct: number,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const bal = `$${(bankroll / 100).toLocaleString("en-US")}`;

  const subject = isEs
    ? "¡Estás FONDEADO! 🏆"
    : isPt
      ? "Você está FINANCIADO! 🏆"
      : "You're FUNDED! 🏆";

  const headerTitle = isEs
    ? "¡Cuenta fondeada activada!"
    : isPt
      ? "Conta financiada ativada!"
      : "Funded account activated!";

  const h2 = isEs
    ? `¡Felicidades, ${n}! Oficialmente estás fondeado.`
    : isPt
      ? `Parabéns, ${n}! Você está oficialmente financiado.`
      : `Congratulations, ${n}! You're officially funded.`;

  const bodyText = isEs
    ? `Demostraste habilidad élite de trading deportivo en ambas fases. Tu <strong>cuenta fondeada de ${bal}</strong> ya está activa.`
    : isPt
      ? `Você demonstrou habilidade elite de trading esportivo em ambas as fases. Sua <strong>conta financiada de ${bal}</strong> já está ativa.`
      : `You've demonstrated elite sports trading skill across both phases. Your <strong>${bal} funded account</strong> is now active.`;

  const lbl1 = isEs
    ? "Tu reparto de ganancias"
    : isPt
      ? "Sua divisão de lucros"
      : "Your profit split";

  const lbl2 = isEs
    ? "Tamaño de cuenta"
    : isPt
      ? "Tamanho da conta"
      : "Account size";

  const desc = isEs
    ? "Ya puedes solicitar pagos cuando tengas P&L positivo. Completa la verificación KYC primero para desbloquear los retiros."
    : isPt
      ? "Você já pode solicitar saques quando tiver P&L positivo. Complete a verificação KYC primeiro para desbloquear os saques."
      : "You can now request payouts once you have positive P&L. Complete KYC verification first to unlock withdrawals.";

  const cta = isEs
    ? "Solicitar Pago →"
    : isPt
      ? "Solicitar Saque →"
      : "Request Payout →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, `${tierName} · ${bal}`)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <div>
          <div class="stat"><div class="val">${splitPct}%</div><div class="lbl">${lbl1}</div></div>
          <div class="stat"><div class="val">${bal}</div><div class="lbl">${lbl2}</div></div>
        </div>
        <hr/>
        <p>${desc}</p>
        <a href="${localeUrl(locale, "/dashboard/payouts")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 5. Drawdown Warning ──────────────────────────────────────────────────────
export function drawdownWarningEmail(
  name: string | null,
  tierName: string,
  drawdownPct: number,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const pct = drawdownPct.toFixed(1);
  const remaining = (15 - drawdownPct).toFixed(1);

  const subject = isEs
    ? `⚠️ Alerta de drawdown — ${pct}% de ${tierName}`
    : isPt
      ? `⚠️ Alerta de drawdown — ${pct}% de ${tierName}`
      : `⚠️ Drawdown alert — ${pct}% on ${tierName}`;

  const h2 = isEs
    ? `${n}, te acercas al límite de drawdown`
    : isPt
      ? `${n}, você está se aproximando do limite de drawdown`
      : `${n}, you're approaching your drawdown limit`;

  const body = isEs
    ? `Tu drawdown actual es del <strong>${pct}%</strong>. Tienes <strong>${remaining}%</strong> restante antes de alcanzar el límite del 15%. Gestiona tu riesgo con cuidado.`
    : isPt
      ? `Seu drawdown atual é de <strong>${pct}%</strong>. Você tem <strong>${remaining}%</strong> restante antes de atingir o limite de 15%. Gerencie seu risco com cuidado.`
      : `Your current drawdown is <strong>${pct}%</strong>. You have <strong>${remaining}%</strong> remaining before hitting the 15% limit. Manage your risk carefully.`;

  const cta = isEs
    ? "Ver mi desafío →"
    : isPt
      ? "Ver meu desafio →"
      : "View my challenge →";

  return {
    subject,
    html: wrap(
      `<div class="header" style="background:#b45309"><h1>⚠️ ${isEs ? "Alerta de Drawdown" : isPt ? "Alerta de Drawdown" : "Drawdown Alert"}</h1><p>${tierName}</p></div>
      <div class="body">
        <h2>${h2}</h2>
        <p>${body}</p>
        <div>
          <div class="stat"><div class="val" style="color:#fbbf24">${pct}%</div><div class="lbl">${isEs ? "Drawdown actual" : isPt ? "Drawdown atual" : "Current drawdown"}</div></div>
          <div class="stat"><div class="val">${remaining}%</div><div class="lbl">${isEs ? "Margen restante" : isPt ? "Margem restante" : "Margin remaining"}</div></div>
        </div>
        <hr/>
        <a href="${localeUrl(locale, "/dashboard")}" class="btn" style="background:#b45309">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 6. Daily Loss Warning ─────────────────────────────────────────────────────
export function dailyLossWarningEmail(
  name: string | null,
  tierName: string,
  dailyLossPct: number,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const pct = dailyLossPct.toFixed(1);
  const remaining = (10 - dailyLossPct).toFixed(1);

  const subject = isEs
    ? `⚠️ Alerta pérdida diaria — ${pct}% de ${tierName}`
    : isPt
      ? `⚠️ Alerta de perda diária — ${pct}% de ${tierName}`
      : `⚠️ Daily loss alert — ${pct}% on ${tierName}`;

  const h2 = isEs
    ? `${n}, te acercas al límite de pérdida diaria`
    : isPt
      ? `${n}, você está se aproximando do limite de perda diária`
      : `${n}, you're approaching your daily loss limit`;

  const body = isEs
    ? `Tu pérdida diaria actual es del <strong>${pct}%</strong>. Tienes <strong>${remaining}%</strong> restante antes de alcanzar el límite del 10%. El límite se resetea a las 00:00 UTC.`
    : isPt
      ? `Sua perda diária atual é de <strong>${pct}%</strong>. Você tem <strong>${remaining}%</strong> restante antes de atingir o limite de 10%. O limite é redefinido às 00:00 UTC.`
      : `Your current daily loss is <strong>${pct}%</strong>. You have <strong>${remaining}%</strong> remaining before hitting the 10% limit. The limit resets at 00:00 UTC.`;

  const cta = isEs
    ? "Ver mi desafío →"
    : isPt
      ? "Ver meu desafio →"
      : "View my challenge →";

  return {
    subject,
    html: wrap(
      `<div class="header" style="background:#b45309"><h1>⚠️ ${isEs ? "Alerta Pérdida Diaria" : isPt ? "Alerta de Perda Diária" : "Daily Loss Alert"}</h1><p>${tierName}</p></div>
      <div class="body">
        <h2>${h2}</h2>
        <p>${body}</p>
        <div>
          <div class="stat"><div class="val" style="color:#fbbf24">${pct}%</div><div class="lbl">${isEs ? "Pérdida diaria" : isPt ? "Perda diária" : "Daily loss"}</div></div>
          <div class="stat"><div class="val">${remaining}%</div><div class="lbl">${isEs ? "Margen restante" : isPt ? "Margem restante" : "Margin remaining"}</div></div>
        </div>
        <hr/>
        <a href="${localeUrl(locale, "/dashboard")}" class="btn" style="background:#b45309">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 7. Challenge Failed ──────────────────────────────────────────────────────
export function challengeFailedEmail(
  name: string | null,
  tierName: string,
  reason: string,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";

  const subject = isEs
    ? `Desafío finalizado — ${tierName}`
    : isPt
      ? `Desafio encerrado — ${tierName}`
      : `Challenge ended — ${tierName}`;

  const headerTitle = isEs
    ? "Desafío finalizado"
    : isPt
      ? "Desafio encerrado"
      : "Challenge ended";

  const h2 = isEs
    ? `No te rindas, ${n}.`
    : isPt
      ? `Não desista, ${n}.`
      : `Don't give up, ${n}.`;

  const bodyText = isEs
    ? `Tu desafío <strong>${tierName}</strong> ha finalizado. <strong>Razón:</strong> ${reason}.`
    : isPt
      ? `Seu desafio <strong>${tierName}</strong> foi encerrado. <strong>Motivo:</strong> ${reason}.`
      : `Your <strong>${tierName}</strong> challenge has ended. <strong>Reason:</strong> ${reason}.`;

  const tip = isEs
    ? "Los mejores traders aprenden de cada operación. Revisa tus picks en el panel de análisis e identifica patrones en tus pérdidas antes de intentarlo de nuevo."
    : isPt
      ? "Os melhores traders aprendem com cada operação. Revise seus picks no painel de análises e identifique padrões nas suas perdas antes de tentar novamente."
      : "The best traders learn from every trade. Review your picks in the analytics panel and identify patterns in your losses before retrying.";

  const cta = isEs
    ? "Revisar Analytics →"
    : isPt
      ? "Revisar Análises →"
      : "Review Analytics →";

  const retry = isEs
    ? "Intentarlo de nuevo →"
    : isPt
      ? "Tentar novamente →"
      : "Try again →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, tierName)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <p>${tip}</p>
        <a href="${localeUrl(locale, "/dashboard/analytics")}" class="btn">${cta}</a>
        <hr/>
        <a href="${localeUrl(locale, "/challenges")}" style="color:#c9a84c;font-size:13px">${retry}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 6. Payout Requested ──────────────────────────────────────────────────────
export function payoutRequestedEmail(
  name: string | null,
  amount: number,
  method: string,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;

  const subject = isEs
    ? `Solicitud de pago recibida — ${amt}`
    : isPt
      ? `Solicitação de saque recebida — ${amt}`
      : `Payout request received — ${amt}`;

  const headerTitle = isEs
    ? "Solicitud de pago recibida"
    : isPt
      ? "Solicitação de saque recebida"
      : "Payout request received";

  const h2 = isEs
    ? `Recibimos tu solicitud de pago, ${n}.`
    : isPt
      ? `Recebemos sua solicitação, ${n}.`
      : `We've received your payout request, ${n}.`;

  const lbl1 = isEs ? "Monto" : isPt ? "Valor" : "Amount";
  const lbl2 = isEs ? "Método" : isPt ? "Método" : "Method";
  const lbl3 = isEs
    ? "Tiempo de proceso"
    : isPt
      ? "Tempo de processamento"
      : "Processing time";
  const processingTime = isEs ? "3–5 días" : isPt ? "3–5 dias" : "3–5 days";

  const bodyText = isEs
    ? "Nuestro equipo revisa todas las solicitudes de pago en 1 día hábil. Recibirás un correo de confirmación cuando tu pago sea procesado."
    : isPt
      ? "Nossa equipe revisa todas as solicitações de saque em 1 dia útil. Você receberá um e-mail de confirmação quando seu saque for processado."
      : "Our team reviews all payout requests within 1 business day. You'll receive a confirmation email once your payout is processed.";

  const cta = isEs
    ? "Seguir Pago →"
    : isPt
      ? "Acompanhar Saque →"
      : "Track Payout →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, amt)}
      <div class="body">
        <h2>${h2}</h2>
        <div>
          <div class="stat"><div class="val">${amt}</div><div class="lbl">${lbl1}</div></div>
          <div class="stat"><div class="val">${method}</div><div class="lbl">${lbl2}</div></div>
          <div class="stat"><div class="val">${processingTime}</div><div class="lbl">${lbl3}</div></div>
        </div>
        <hr/>
        <p>${bodyText}</p>
        <a href="${localeUrl(locale, "/dashboard/payouts")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 7. Payout Paid ───────────────────────────────────────────────────────────
export function payoutPaidEmail(
  name: string | null,
  amount: number,
  method: string,
  txRef?: string | null,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;

  const subject = isEs
    ? `Pago enviado — ${amt} ✅`
    : isPt
      ? `Saque enviado — ${amt} ✅`
      : `Payout sent — ${amt} ✅`;

  const headerTitle = isEs
    ? "¡Pago enviado!"
    : isPt
      ? "Saque enviado!"
      : "Payout sent!";

  const h2 = isEs
    ? `¡Tu dinero está en camino, ${n}!`
    : isPt
      ? `Seu dinheiro está a caminho, ${n}!`
      : `Your money is on the way, ${n}!`;

  const bodyText = isEs
    ? `Hemos procesado tu pago de <strong>${amt}</strong> vía <strong>${method}</strong>.`
    : isPt
      ? `Processamos seu saque de <strong>${amt}</strong> via <strong>${method}</strong>.`
      : `We've processed your <strong>${amt}</strong> payout via <strong>${method}</strong>.`;

  const timing = isEs
    ? "Espera 1–3 días hábiles para que los fondos lleguen según tu método de pago."
    : isPt
      ? "Aguarde 1–3 dias úteis para os fundos chegarem dependendo do seu método de pagamento."
      : "Allow 1–3 business days for the funds to arrive depending on your payment method.";

  const refLabel = isEs ? "Referencia" : isPt ? "Referência" : "Reference";

  const cta = isEs
    ? "Ver Historial de Pagos →"
    : isPt
      ? "Ver Histórico de Saques →"
      : "View Payout History →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, amt)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        ${txRef ? `<p style="font-size:12px;color:#737373">${refLabel}: <code style="background:#1f1f1f;padding:2px 6px;border-radius:4px">${txRef}</code></p>` : ""}
        <p>${timing}</p>
        <a href="${localeUrl(locale, "/dashboard/payouts")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 8. Payout Rejected ───────────────────────────────────────────────────────
export function payoutRejectedEmail(
  name: string | null,
  amount: number,
  reason?: string | null,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";
  const amt = `$${(amount / 100).toFixed(2)}`;

  const subject = isEs
    ? `Actualización de solicitud de pago — ${amt}`
    : isPt
      ? `Atualização da solicitação de saque — ${amt}`
      : `Payout request update — ${amt}`;

  const headerTitle = isEs
    ? "Actualización de solicitud de pago"
    : isPt
      ? "Atualização da solicitação de saque"
      : "Payout request update";

  const h2 = isEs
    ? `Acción requerida, ${n}.`
    : isPt
      ? `Ação necessária, ${n}.`
      : `Action required, ${n}.`;

  const bodyText = isEs
    ? `Tu solicitud de pago por <strong>${amt}</strong> no pudo procesarse en este momento.`
    : isPt
      ? `Sua solicitação de saque de <strong>${amt}</strong> não pôde ser processada no momento.`
      : `Your payout request for <strong>${amt}</strong> could not be processed at this time.`;

  const reasonLabel = isEs ? "Razón" : isPt ? "Motivo" : "Reason";

  const desc = isEs
    ? "Por favor contacta a nuestro equipo de soporte para resolver esto. Tu balance no ha sido afectado."
    : isPt
      ? "Por favor, entre em contato com nossa equipe de suporte para resolver isso. Seu saldo não foi afetado."
      : "Please contact our support team so we can help resolve this. Your balance has not been affected.";

  const cta = isEs
    ? "Contactar Soporte →"
    : isPt
      ? "Contatar Suporte →"
      : "Contact Support →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, amt)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        ${reason ? `<p><strong>${reasonLabel}:</strong> ${reason}</p>` : ""}
        <p>${desc}</p>
        <a href="mailto:${process.env.SUPPORT_EMAIL ?? "support@playfunded.lat"}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 9. KYC Approved ─────────────────────────────────────────────────────────
export function kycApprovedEmail(
  name: string | null,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";

  const subject = isEs
    ? "Identidad verificada ✅"
    : isPt
      ? "Identidade verificada ✅"
      : "Identity verified ✅";

  const headerTitle = isEs
    ? "¡Identidad verificada!"
    : isPt
      ? "Identidade verificada!"
      : "Identity verified!";

  const headerSub = isEs
    ? "Ya puedes solicitar pagos"
    : isPt
      ? "Você já pode solicitar saques"
      : "You can now request payouts";

  const h2 = isEs
    ? `¡Bienvenido al club verificado, ${n}!`
    : isPt
      ? `Bem-vindo ao clube verificado, ${n}!`
      : `Welcome to the verified club, ${n}!`;

  const bodyText = isEs
    ? "Tu identidad ha sido verificada exitosamente. Ya puedes solicitar pagos desde tu cuenta fondeada."
    : isPt
      ? "Sua identidade foi verificada com sucesso. Você já pode solicitar saques da sua conta financiada."
      : "Your identity has been successfully verified. You can now request payouts from your funded account.";

  const cta = isEs
    ? "Solicitar Pago →"
    : isPt
      ? "Solicitar Saque →"
      : "Request Payout →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, headerSub)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <a href="${localeUrl(locale, "/dashboard/payouts")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 10. KYC Rejected ────────────────────────────────────────────────────────
export function kycRejectedEmail(
  name: string | null,
  note?: string | null,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const n = name ?? "Trader";

  const subject = isEs
    ? "Actualización de verificación de identidad"
    : isPt
      ? "Atualização da verificação de identidade"
      : "Identity verification update";

  const headerTitle = isEs
    ? "Actualización de verificación de identidad"
    : isPt
      ? "Atualização da verificação de identidade"
      : "Identity verification update";

  const h2 = isEs
    ? `Necesitamos un poco más de tu parte, ${n}.`
    : isPt
      ? `Precisamos de mais informações, ${n}.`
      : `We need a little more from you, ${n}.`;

  const bodyText = isEs
    ? "Tu verificación de identidad no pudo ser aprobada en este momento."
    : isPt
      ? "Sua verificação de identidade não pôde ser aprovada no momento."
      : "Your identity verification submission could not be approved at this time.";

  const noteLabel = isEs ? "Razón" : isPt ? "Motivo" : "Reason";

  const desc = isEs
    ? "Por favor reenvía con documentos más claros. Si tienes preguntas, contacta a nuestro equipo de soporte."
    : isPt
      ? "Por favor, reenvie com documentos mais claros. Se tiver dúvidas, entre em contato com nossa equipe de suporte."
      : "Please resubmit with clearer documents. If you have any questions, contact our support team.";

  const cta = isEs
    ? "Reenviar KYC →"
    : isPt
      ? "Reenviar KYC →"
      : "Resubmit KYC →";

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, "")}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        ${note ? `<p><strong>${noteLabel}:</strong> ${note}</p>` : ""}
        <p>${desc}</p>
        <a href="${localeUrl(locale, "/dashboard/payouts")}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}

// ── 11. Gift Voucher ─────────────────────────────────────────────────────────
export function giftVoucherEmail(
  recipientEmail: string,
  senderName: string | null,
  tierName: string,
  token: string,
  locale = "es-419",
): { subject: string; html: string } {
  const isEs = locale.startsWith("es");
  const isPt = locale === "pt-BR";
  const sender = senderName ?? (isEs ? "Alguien" : isPt ? "Alguém" : "Someone");

  const subject = isEs
    ? "¡Recibiste un regalo de desafío PlayFunded! 🎁"
    : isPt
      ? "Você recebeu um presente de desafio PlayFunded! 🎁"
      : "You received a PlayFunded challenge gift! 🎁";

  const headerTitle = isEs
    ? "¡Te regalaron un desafío! 🎁"
    : isPt
      ? "Você recebeu um desafio! 🎁"
      : "You've been gifted a challenge! 🎁";

  const h2 = isEs
    ? `${sender} te regaló un desafío PlayFunded.`
    : isPt
      ? `${sender} te deu um desafio PlayFunded.`
      : `${sender} gave you a PlayFunded challenge.`;

  const bodyText = isEs
    ? `Recibiste un desafío <strong>${tierName}</strong> — una entrada completamente pagada para demostrar tus habilidades de trading deportivo y ganar una cuenta fondeada.`
    : isPt
      ? `Você recebeu um desafio <strong>${tierName}</strong> — uma entrada totalmente paga para provar suas habilidades de trading esportivo e ganhar uma conta financiada.`
      : `You've received a <strong>${tierName}</strong> challenge — a fully paid entry to prove your sports trading skills and earn a funded account.`;

  const statLbl = isEs
    ? "Tu código de regalo"
    : isPt
      ? "Seu código de presente"
      : "Your gift code";

  const desc = isEs
    ? "Crea una cuenta y canjea tu regalo para activar tu desafío. El código es de uso único."
    : isPt
      ? "Crie uma conta e resgate seu presente para ativar seu desafio. O código é de uso único."
      : "Create an account and redeem your gift to activate your challenge. The code is single-use.";

  const cta = isEs
    ? "Canjear Regalo →"
    : isPt
      ? "Resgatar Presente →"
      : "Redeem Gift →";

  // recipientEmail is kept in the signature for backwards compatibility
  void recipientEmail;

  return {
    subject,
    html: wrap(
      `
      ${header(headerTitle, tierName)}
      <div class="body">
        <h2>${h2}</h2>
        <p>${bodyText}</p>
        <div class="stat"><div class="val" style="font-size:16px;letter-spacing:2px">${token}</div><div class="lbl">${statLbl}</div></div>
        <hr/>
        <p>${desc}</p>
        <a href="${localeUrl(locale, `/redeem/${token}`)}" class="btn">${cta}</a>
      </div>`,
      locale,
    ),
  };
}
