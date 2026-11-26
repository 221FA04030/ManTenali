import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Labelled input with error text wired to aria-describedby. `endAdornment`
 * (optional) is shown inside the right edge of the field, e.g. a show-password button.
 */
export const Input = forwardRef(function Input(
  { label, error, hint, className, id, as = 'input', children, endAdornment, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const Field = as;
  const field = (
    <Field
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        'min-h-tap w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-soft',
        'focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200',
        error ? 'border-red-500' : 'border-brand-200',
        as === 'textarea' && 'min-h-[96px]',
        endAdornment && 'pr-14',
      )}
      {...rest}
    >
      {children}
    </Field>
  );
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      {endAdornment ? (
        <div className="relative">
          {field}
          <div className="absolute inset-y-0 right-0 flex items-center">{endAdornment}</div>
        </div>
      ) : (
        field
      )}
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
