# ADR 0224: Settings Usages Dashboard with Token Heatmap and Model Pricing

- Status: Accepted (amends ADR 0173)
- Date: 2026-09-13
- Deciders: PI-Desktop core
- Related: ADR 0171, ADR 0173, ADR 0047, D103, D331, D335, `04-ux/06-settings-ia.md`

## Context

Users require full visibility into their token consumption directly within application Settings,
including timeframes (today, 7 days, 1 month, 2 months, all time), an interactive GitHub-style
contribution graph calendar heatmap, per-model token usage breakdown, and calculated cost in USD
for each model and timeframe.

## Decision

1. **Settings Usages Destination**:
   Add `usages` to Settings IA under Preferences.
2. **Timeframe Rollups**:
   Display KPIs and a summary table for today, 7 days, 30 days, 60 days, and all time.
3. **Contribution Graph**:
   Render a 53-week GitHub-style activity heatmap calendar with interactive day inspection.
4. **Per-Model Usage and USD Pricing**:
   Extract exact model consumption and compute USD costs using standard unit rates ($/1M tokens)
   with fallback support for custom endpoints.

## Consequences

- Full transparency on token consumption and dollar spend without leaving the core application.
- Compatible with existing `stats.getTokenUsageHistory` host RPC.
