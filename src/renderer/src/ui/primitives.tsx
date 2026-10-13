import { useId, type ReactNode } from 'react'

export function Panel({ title, badge, children, id }: { title: string; badge?: ReactNode; children: ReactNode; id?: string }): React.JSX.Element {
  return (
    <section className="panel" aria-labelledby={id ?? title} data-panel={id ?? title}>
      <h2 id={id ?? title}><span>{title}</span>{badge}</h2>
      {children}
    </section>
  )
}

export function KV({ items }: { items: Array<[string, ReactNode]> }): React.JSX.Element {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>
      ))}
    </dl>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }): React.JSX.Element {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }): React.JSX.Element {
  const id = useId()
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{step < 1 ? value.toFixed(2) : value}{unit}</output>
    </div>
  )
}
