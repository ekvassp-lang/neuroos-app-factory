import type { ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="nf-card">
      {title && <h2 className="nf-card-title">{title}</h2>}
      {children}
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`nf-badge nf-badge--${value.toLowerCase()}`}>{value}</span>;
}

export function Loader({ label = 'Загрузка…' }: { label?: string }) {
  return <p className="nf-loading">{label}</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="nf-error" role="alert">
      <p>Ошибка: {message}</p>
      {onRetry && (
        <button type="button" className="nf-button" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="nf-empty">{text}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="nf-field">
      <span className="nf-field-label">{label}</span>
      {children}
    </label>
  );
}
