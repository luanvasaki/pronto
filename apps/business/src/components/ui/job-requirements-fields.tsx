import { CNH_CATEGORY_OPTIONS } from '@shift/shared';
import { Input } from './input';

export interface JobRequirementsFieldsProps {
  requiresExperience: boolean | null;
  onRequiresExperienceChange: (value: boolean) => void;
  dressCode: string;
  onDressCodeChange: (value: string) => void;
  toolsRequired: string;
  onToolsRequiredChange: (value: string) => void;
  cnhCategory: string;
  onCnhCategoryChange: (value: string) => void;
  cnhRequired: boolean;
  onCnhRequiredChange: (value: boolean) => void;
  minorsAllowed: boolean;
  onMinorsAllowedChange: (value: boolean) => void;
}

/** Bloco "O que essa vaga exige?" — idêntico entre nova vaga e editar vaga. */
export function JobRequirementsFields({
  requiresExperience,
  onRequiresExperienceChange,
  dressCode,
  onDressCodeChange,
  toolsRequired,
  onToolsRequiredChange,
  cnhCategory,
  onCnhCategoryChange,
  cnhRequired,
  onCnhRequiredChange,
  minorsAllowed,
  onMinorsAllowedChange,
}: JobRequirementsFieldsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <p className="font-heading text-sm font-bold text-text">O que essa vaga exige?</p>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-text-secondary">
          Precisa de experiência anterior?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={requiresExperience === true}
            onClick={() => onRequiresExperienceChange(true)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              requiresExperience === true
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-secondary'
            }`}
          >
            Sim
          </button>
          <button
            type="button"
            aria-pressed={requiresExperience === false}
            onClick={() => onRequiresExperienceChange(false)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              requiresExperience === false
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-secondary'
            }`}
          >
            Não
          </button>
        </div>
      </div>

      <Input
        id="dressCode"
        label="Vestimenta exigida (opcional)"
        type="text"
        placeholder="Social, uniforme fornecido, traje esportivo..."
        value={dressCode}
        onChange={(event) => onDressCodeChange(event.target.value)}
      />

      <Input
        id="toolsRequired"
        label="Ferramentas que o profissional precisa levar (opcional)"
        type="text"
        placeholder="Câmera própria, ferramentas de bar..."
        value={toolsRequired}
        onChange={(event) => onToolsRequiredChange(event.target.value)}
      />

      <div>
        <label htmlFor="cnhCategory" className="mb-1.5 block text-sm font-medium text-text-secondary">
          Exige CNH? (opcional)
        </label>
        <select
          id="cnhCategory"
          value={cnhCategory}
          onChange={(event) => onCnhCategoryChange(event.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
        >
          <option value="">Nenhuma exigência</option>
          {CNH_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {cnhCategory && (
          <div className="mt-2.5">
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Isso é obrigatório pra se candidatar ou só uma preferência?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={cnhRequired}
                onClick={() => onCnhRequiredChange(true)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  cnhRequired
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Obrigatório
              </button>
              <button
                type="button"
                aria-pressed={!cnhRequired}
                onClick={() => onCnhRequiredChange(false)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  !cnhRequired
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Preferência
              </button>
            </div>
            {cnhRequired && (
              <p className="mt-1.5 text-xs text-text-secondary">
                Quem não tiver CNH {cnhCategory} não vai conseguir se candidatar.
              </p>
            )}
          </div>
        )}
      </div>

      <label htmlFor="minorsAllowed" className="flex items-start gap-2.5 text-sm text-text">
        <input
          id="minorsAllowed"
          type="checkbox"
          checked={minorsAllowed}
          onChange={(event) => onMinorsAllowedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
        />
        <span>
          <span className="font-medium">Vaga disponível pra menores de idade (16 e 17 anos)</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            Por padrão, só trabalhadores maiores de 18 anos veem essa vaga. Marque essa opção se ela também
            pode ser feita por adolescentes com autorização do responsável.
          </span>
        </span>
      </label>
    </div>
  );
}
