import { cn } from '../../lib/cn.js';

/** White rounded card with a soft shadow (UI reference card style). */
export function Card({ as: Tag = 'div', className, padded = true, children, ...rest }) {
  return (
    <Tag
      className={cn('rounded-card bg-white shadow-card ring-1 ring-brand-100', padded && 'p-4', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
