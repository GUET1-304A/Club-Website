import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type OptionHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type GlassSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean
  wrapperClassName?: string
}

interface SelectOption {
  key: string
  value: string
  label: ReactNode
  disabled: boolean
}

export default function GlassSelect({
  className = '',
  wrapperClassName = '',
  compact = false,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  title,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: GlassSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const generatedId = useId()
  const menuId = `${generatedId}-menu`
  const triggerId = id || `${generatedId}-trigger`

  const options: SelectOption[] = Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child) || child.type !== 'option') return []
    const optionValue = child.props.value !== undefined
      ? String(child.props.value)
      : String(child.props.children ?? '')
    return [{
      key: String(child.key ?? `${index}-${optionValue}`),
      value: optionValue,
      label: child.props.label ?? child.props.children,
      disabled: Boolean(child.props.disabled),
    }]
  })

  const currentValue = value !== undefined
    ? String(value)
    : defaultValue !== undefined
      ? String(defaultValue)
      : ''
  const selectedIndex = options.findIndex(option => option.value === currentValue)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  const focusOption = (index: number) => {
    if (options.length === 0) return
    optionRefs.current[(index + options.length) % options.length]?.focus()
  }

  const openMenu = (focusIndex = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled) return
    const box = triggerRef.current?.getBoundingClientRect()
    if (!box) return

    const safeMargin = 10
    const gap = 8
    const width = Math.min(
      Math.max(box.width, compact ? 180 : 220),
      Math.min(compact ? 300 : 380, window.innerWidth - safeMargin * 2),
    )
    const desiredHeight = Math.min(options.length * 44 + 12, 320)
    const availableBelow = window.innerHeight - box.bottom - gap - safeMargin
    const availableAbove = box.top - gap - safeMargin
    const placeBelow = availableBelow >= desiredHeight || availableBelow >= availableAbove
    const maxHeight = Math.max(120, Math.min(desiredHeight, placeBelow ? availableBelow : availableAbove))
    const top = placeBelow
      ? box.bottom + gap
      : Math.max(safeMargin, box.top - Math.min(desiredHeight, availableAbove) - gap)

    setRect({
      left: Math.max(safeMargin, Math.min(box.left, window.innerWidth - width - safeMargin)),
      top,
      width,
      maxHeight,
    })
    setOpen(true)
    requestAnimationFrame(() => focusOption(focusIndex))
  }

  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as ChangeEvent<HTMLSelectElement>)
    closeMenu(true)
  }

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(index + (event.key === 'ArrowDown' ? 1 : -1))
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusOption(event.key === 'Home' ? 0 : options.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(index)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
      return
    }
    if (event.key === 'Tab') closeMenu()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
    }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className={`glass-select-wrap ${wrapperClassName}`.trim()}>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        title={title}
        aria-required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu(selectedIndex >= 0 ? selectedIndex : event.key === 'ArrowUp' ? options.length - 1 : 0)
          }
        }}
        className={`glass-select ${compact ? 'glass-select-compact' : ''} ${className}`.trim()}
      >
        <span className="min-w-0 truncate">{selected?.label ?? '请选择'}</span>
      </button>
      <ChevronDown className={`glass-select-arrow ${open ? 'is-open' : ''}`.trim()} aria-hidden="true" />

      {open && rect && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-labelledby={triggerId}
          className="glass-select-menu"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            maxHeight: rect.maxHeight,
          }}
        >
          {options.map((option, index) => {
            const active = option.value === currentValue
            return (
              <button
                key={option.key}
                ref={node => { optionRefs.current[index] = node }}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                tabIndex={-1}
                onClick={() => choose(index)}
                onKeyDown={event => handleOptionKeyDown(event, index)}
                className="glass-select-option"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-[#3457ff]" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
