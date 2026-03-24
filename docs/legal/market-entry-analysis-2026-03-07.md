# PlayFunded Market-Entry and Establishment Analysis

Date: 2026-03-07

This is a strategic research memo, not legal advice.

## Executive conclusion

The current PlayFunded model is not just an incorporation problem. As described in [README.md](/Users/sebastianizurieta/playfunded/README.md), users pay an entry fee, make sports-event predictions with a simulated bankroll, and can later receive real-money payouts. In most target markets, that is close enough to regulated betting or gambling that company formation alone will not unlock distribution.

Best current recommendation:

1. If the founders and real management are in Spain, establish the parent as a Spanish `S.L.` and treat it as the real headquarters.
2. Do not launch the current paid-entry cash-payout model in Spain, the UK, Brazil, Colombia, or Mexico without country-specific gambling/regulatory clearance and, in several of those markets, a licensing or permit strategy.
3. If speed matters more than preserving the exact product shape, redesign the product so it is clearly outside gambling rules before trying to scale internationally.

## Why incorporation does not solve the problem

Spain’s corporate tax law says an entity is Spanish tax resident if it has its effective place of management in Spain. If PlayFunded is actually directed from Spain, a low-substance foreign company does not reliably solve tax or compliance risk.

Source:
- BOE, Ley 27/2014, art. 8: entities are Spanish resident if incorporated in Spain, domiciled in Spain, or if their "sede de dirección efectiva" is in Spain. Effective management exists where the direction and control of the whole business sits.

## Product-classification view

Inference from the repo and regulator definitions:

- PlayFunded is closer to a paid sports prediction product with cash outcomes than to a pure SaaS tool.
- The simulated bankroll helps, but it does not eliminate the core issue where users pay to participate and can win money based on uncertain sports outcomes.
- In several target countries, regulators define gambling broadly enough that "skill" does not automatically save the model.

That means the legal question is:

`Is this a skill evaluation business that happens to use sports picks, or is it a gambling/betting product in disguise?`

Today, with the current repo design, regulators and processors have a meaningful chance of taking the second view.

## Recommended establishment structure

Assumption: founders, decision-makers, and day-to-day control are mainly in Spain.

Recommended structure now:

1. `PlayFunded Holdings, S.L.` in Spain as the real parent and operating HQ.
2. No country-facing subsidiary until a specific market actually requires one.
3. Add local operating entities only where regulation, payments, or tax rules force it.

Why this is the best default:

- It matches likely management reality, which matters for Spanish tax residence.
- It avoids building around a foreign shell that may fail substance review.
- It is credible for counsel, banks, PSPs, and investors.
- It keeps the group clean if you later add licensed or country-specific subsidiaries.

What I do not recommend:

- A UK or offshore parent with management still in Spain.
- A "light" foreign company chosen only for lower tax if the founders still run everything from Spain.
- Assuming one global entity will let you lawfully target all intended countries.

## Country assessment

### Spain

High risk for the current model.

Key points:

- Spain’s gambling law defines game activity broadly, including risking money on future uncertain outcomes partly dependent on chance, even if skill predominates.
- It defines sports betting as predictions on sports-event outcomes or sports-related facts within those events.
- Non-occasional operators need a general licence, and Spain’s DGOJ also requires the relevant specific licensing path.
- Licensed operators must post significant guarantees. DGOJ states the initial guarantee for a general betting licence is EUR 2 million.
- Spain actively sanctions unlicensed foreign operators.

Implication:

- The current PlayFunded model should be treated as `not safe for Spain day 1`.
- If Spain is a core market, assume a gambling-law workstream, not a normal startup launch.

### United Kingdom

High risk for the current model.

Key points:

- The UK Gambling Commission says a remote general betting licence is required if you provide online betting on real events to consumers in Great Britain, regardless of where the operator is based.
- There is a prize-competition exemption only where the outcome is determined by participant skill, judgment, or knowledge, and the skill test must genuinely deter entry and prevent a proportion of entrants from winning.

Implication:

- The current PlayFunded model does not look safely inside the UK prize-competition exemption.
- If you want the UK with the current model, assume you need specialist UK gambling analysis and likely a regulated route.

### Brazil

Very high barrier for the current model.

Key points:

- Brazil’s Ministry of Finance says fixed-odds betting operators need prior SPA authorization.
- Since 2025-01-01, only SPA-authorized companies can operate nationally.
- The Ministry states only Brazilian companies may operate in the betting sector.
- The authorization fee is BRL 30 million and each authorization covers up to three brands for five years.

Implication:

- Brazil is not a practical early market for the current product unless you commit to a serious regulated-betting build.
- If Brazil remains strategic, plan for a Brazil-specific entity and licensed route, not a simple cross-border launch.

### Colombia

High barrier for the current model.

Key points:

- Coljuegos defines games of chance broadly where the player places a bet or pays for the right to participate and receives a prize if correct on an uncertain outcome.
- Coljuegos treats internet games and sports betting as regulated internet gambling.
- Coljuegos publicly states unauthorized betting portals are illegal and actively blocks them.

Implication:

- Colombia is not a safe "launch first and see" market for this model.
- Assume contract or authorization requirements if the model is treated as internet gambling.

### Mexico

High risk and structurally messy.

Key points:

- SEGOB states games with bets and sweepstakes require express permission under the Federal Law of Games and Sweepstakes.
- SEGOB’s public materials for remote betting centers show the regime is permit-based and formal.

Implication:

- Mexico is unlikely to be clean for an unlicensed paid-entry sports-outcome product.
- Entry likely requires a local permit strategy or a partner structure with existing permissions.

### Ecuador

Most interesting of the listed priority markets, but still not clean enough to call "safe."

Key points:

- Ecuador’s SRI has a tax regime for sports-prediction operators, including non-resident operators.
- The SRI requires a resident proxy in Ecuador for non-resident operators registering for the sports-prediction tax regime.
- Ecuador’s National Assembly stated on 2026-02-10 that the new sports law includes regulation of sports predictions and was being sent for publication.

Implication:

- Ecuador appears more workable than Spain, Brazil, Colombia, or the UK for an early legal memo.
- But it is still moving, and the existence of a tax regime does not itself equal product legality or processor approval.
- Ecuador is a candidate for deeper local-counsel analysis, not an automatic go-live.

## Payments and processor reality

Processor policy is a second hard gate.

### Stripe

Stripe’s restricted-business policy is a major warning sign for the current model. Stripe lists as prohibited:

- gambling and internet gambling
- games of skill with a monetary or material prize
- entry fees that promise the entrant will win a prize of value
- sports forecasting or odds-making with a monetary or material prize

Implication:

- Even if one country memo were favorable, Stripe may still reject the model as currently framed.

### Mercado Pago

Mercado Pago states unregulated lotteries or gambling products are prohibited, including online bets and casinos that lack the necessary authorization.

Implication:

- Mercado Pago is not a fallback for an unlicensed betting-adjacent launch.

### dLocal or similar cross-border PSPs

dLocal’s official materials say they help merchants accept payments and send payouts in emerging markets without needing local entities in each country.

Implication:

- This can solve payments plumbing.
- It does not solve gaming classification, licensing, or advertising legality.

## Strategic options

### Option A: Keep the current model and build a regulated path

Best if you want the exact business model.

What it means:

- Spain HQ if management is in Spain.
- Separate country legal memos for each launch market.
- Pre-clear the exact product with PSP/compliance teams before launch.
- Expect licensing or permit-heavy work in Spain, UK, Brazil, Colombia, and likely Mexico.
- Launch sequence only after counsel says the model is legal and commercially bankable.

My view:

- This is slower, more expensive, and more defensible.

### Option B: Redesign to reduce gambling classification risk

Best if speed matters.

Potential redesign moves:

- Remove paid entry as the condition for cash-prize eligibility.
- Add a real free-entry route where relevant.
- Shift the paid product to software, coaching, analytics, or evaluation access, while separating any prize mechanism.
- Avoid direct sports forecasting for monetary prizes where processors explicitly prohibit it.
- Tighten the "skill" component so it is not just selecting sports outcomes.

My view:

- This is the only realistic way to approach broad international rollout without becoming a licensed betting operator.
- Even then, Spain and some LATAM markets may still require review because paid competitions can remain regulated.

## What I would do now

1. Form the parent in Spain if Spain is the real management center.
2. Freeze any plan to launch the current paid-entry payout product into Spain, UK, Brazil, Colombia, or Mexico until external counsel reviews it.
3. Commission short local memos first for:
   - Ecuador
   - Mexico
   - Spain
   - Brazil
   - Colombia
   - United Kingdom
4. Submit the exact product memo and flow to Stripe, Mercado Pago, and at least one cross-border LATAM PSP for written compliance feedback.
5. Decide at board/founder level between:
   - regulated betting route
   - de-gambling redesign route
6. Only after that, finalize launch sequencing and legal documents.

## Practical recommendation

If you asked me for the single best answer today:

- Establish the real parent in Spain.
- Treat the current business model as regulated-or-near-regulated in most intended countries.
- Do not try to "jurisdiction-shop" your way around that with a foreign shell.
- If you need fast regional expansion, change the product before scaling.

## Sources

- BOE, Ley 27/2014, art. 8 (Spanish corporate tax residence / effective management):
  https://www.boe.es/buscar/pdf/2014/BOE-A-2014-12328-consolidado.pdf
- BOE, Ley 13/2011 de regulación del juego:
  https://www.boe.es/buscar/act.php?id=BOE-A-2011-9280
- DGOJ, authorized gaming and operator licensing:
  https://www.ordenacionjuego.es/participantes-juego/juego-autorizado
  https://www.ordenacionjuego.es/operadores-juego/informacion-operadores/licencias-juego
  https://www.ordenacionjuego.es/operadores-juego/informacion-operadores/garantias-operadores-licencia
  https://www.ordenacionjuego.es/novedades/dgoj-refuerza-lucha-contra-juego-ilegal-espana-proteccion-personas-jugadoras
- UK Gambling Commission, remote betting licence and prize competitions:
  https://www.gamblingcommission.gov.uk/licensees-and-businesses/licences-and-fees/remote-general-betting-standard-real-events-licence
  https://www.gamblingcommission.gov.uk/public-and-players/guide/page/free-draws-and-prize-competitions
- Brazil Ministry of Finance / SPA:
  https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/apostas-de-quota-fixa/apostas-de-quota-fixa
  https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/apostas-de-quota-fixa/tire-suas-duvidas
- Coljuegos:
  https://www.coljuegos.gov.co/glosario/j/
  https://www.coljuegos.gov.co/publicaciones/306893/portal-de-apuestas-por-internet-1win-no-esta-autorizada-para-operar-en-colombia/
  https://www.coljuegos.gov.co/publicaciones/juegos_operados_por_internet_pub
- SEGOB Juegos y Sorteos:
  https://www.sitios.segob.gob.mx/es/Juegos_y_Sorteos/home
  https://www.sitios.segob.gob.mx/es/Juegos_y_Sorteos/Quienes_Somos
  https://juegosysorteos.segob.gob.mx/es/Juegos_y_Sorteos/Prohibiciones
  https://sitios.segob.gob.mx/es/Juegos_y_Sorteos/Requisitos_Art_20_Fraccion_I
- Ecuador SRI and Asamblea Nacional:
  https://www.sri.gob.ec/impuesto-a-la-renta-unico-a-los-operadores-de-pronosticos-deportivos
  https://www.asambleanacional.gob.ec/es/node/113182
- Stripe restricted businesses:
  https://stripe.com/legal/restricted-businesses
- Mercado Pago prohibited activities:
  https://global-selling.mercadopago.com/help/18572
- dLocal cross-border payments:
  https://www.dlocal.com/press-releases/dlocal-and-paypal-expand-access-to-local-payments-across-emerging-markets/
