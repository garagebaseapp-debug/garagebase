const vehicleText = (value: unknown) => String(value ?? '').trim()

const capitalizeBrand = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : ''

export const vehicleDisplayName = (vehicle: any, fallback = 'Vozilo') => {
  const brand = capitalizeBrand(vehicleText(vehicle?.znamka))
  const model = vehicleText(vehicle?.model).toUpperCase()
  return [brand, model].filter(Boolean).join(' ') || fallback
}
