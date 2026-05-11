# GarageBase translation guide

GarageBase mora ostati uporaben v slovenscini in anglescini.

## Pravilo za nove funkcije

- Vsak nov uporabniku viden tekst mora imeti slovensko in anglesko razlicico.
- Na novih straneh uporabi `useTx()` iz `src/lib/i18n.tsx`.
- Za tekst uporabi `tx('Slovenski tekst', 'English text')`.
- Za datum uporabi `locale` iz `useTx()`.
- Ne dodajaj samo slovenskih stringov z upanjem, da jih bo globalni DOM prevajalnik kasneje ujel.

Primer:

```tsx
import { useTx } from '@/lib/i18n'

export default function Primer() {
  const { tx, locale } = useTx()

  return (
    <>
      <h1>{tx('Opomniki', 'Reminders')}</h1>
      <p>{new Date().toLocaleDateString(locale)}</p>
    </>
  )
}
```

## Preverjanje pred deployem

Za vsak vecji popravek zazeni:

```bash
npm run check
```

Ta ukaz vkljuci `npm run test:i18n`, ki preveri osnovne `tx(sl, en)` klice.

Opozorila za izraze, ki so namenoma enaki v obeh jezikih, npr. `Feedback`, `Admin panel` ali `PDF Report`, so dovoljena.
