'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  id?: string;
}

/**
 * Glassmorphism card component with optional hover effect and glow border.
 */
export default function Card({
  children,
  className = '',
  hover = false,
  glow = false,
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={`
        glass-card p-6
        ${hover ? 'glass-card-hover' : ''}
        ${glow ? 'glow-brand' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
