import { ConsentDocumentChapter } from '@shift/shared';

export interface ConsentDocumentReaderProps {
  chapters: ConsentDocumentChapter[];
  declaration?: string;
}

/** Leitor rolável do documento — capítulos numerados e visualmente separados, corpo com quebras de parágrafo preservadas. */
export function ConsentDocumentReader({ chapters, declaration }: ConsentDocumentReaderProps) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-4">
      {chapters.map((chapter) => (
        <div key={chapter.number}>
          <p className="text-xs font-semibold text-primary">Capítulo {chapter.number}</p>
          <h2 className="font-heading text-base font-bold text-text">{chapter.heading}</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm text-text-secondary">{chapter.body}</p>
        </div>
      ))}
      {declaration && (
        <div className="border-t border-border pt-4">
          <p className="whitespace-pre-line text-sm text-text-secondary">{declaration}</p>
        </div>
      )}
    </div>
  );
}
