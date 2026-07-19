import { Rating, RatingCategory } from '@shift/shared';
import { Button } from './ui/button';

export interface RatingFormProps {
  title: string;
  categories: readonly RatingCategory[];
  scores: Record<string, number>;
  comment: string;
  onChangeScore: (categoryId: string, score: number) => void;
  onChangeComment: (comment: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error?: string;
}

const STAR_VALUES = [1, 2, 3, 4, 5];

/** Uma avaliação por categoria (1-5 estrelas cada) + comentário livre opcional. */
export function RatingForm({
  title,
  categories,
  scores,
  comment,
  onChangeScore,
  onChangeComment,
  onSubmit,
  isSubmitting,
  error,
}: RatingFormProps) {
  const isComplete = categories.length > 0 && categories.every((category) => Boolean(scores[category.id]));

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-border p-4">
      <p className="font-heading text-[16px] font-bold text-text">{title}</p>
      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <div key={category.id}>
            <p className="text-[14px] font-semibold text-text-secondary">{category.label}</p>
            <div className="mt-1 flex gap-1.5" role="group" aria-label={`${category.label} — nota de 1 a 5`}>
              {STAR_VALUES.map((value) => {
                const selected = (scores[category.id] ?? 0) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${category.label}: ${value} de 5`}
                    aria-pressed={selected}
                    onClick={() => onChangeScore(category.id, value)}
                    className={`text-3xl leading-none transition ${selected ? 'text-primary' : 'text-border'}`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <textarea
        rows={2}
        placeholder="Escreva um comentário (opcional)"
        value={comment}
        onChange={(event) => onChangeComment(event.target.value)}
        className="w-full rounded-sm border border-border bg-surface px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="button" isLoading={isSubmitting} disabled={!isComplete} onClick={onSubmit}>
        Enviar avaliação
      </Button>
    </div>
  );
}

export interface RatingSummaryProps {
  rating: Rating;
  categories: readonly RatingCategory[];
}

/** Resumo de uma avaliação já enviada — nota geral + breakdown por categoria, quando disponível. */
export function RatingSummary({ rating, categories }: RatingSummaryProps) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-sm text-success">Você avaliou: {rating.score} de 5.</p>
      {rating.categoryScores && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const score = rating.categoryScores?.[category.id];
            if (!score) return null;
            return (
              <span
                key={category.id}
                className="rounded-lg bg-background px-2.5 py-1 text-[14px] font-semibold text-text-secondary"
              >
                ★{score} {category.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
