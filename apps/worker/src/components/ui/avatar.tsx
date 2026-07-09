const AVATAR_COLORS = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-success'];

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-[46px] w-[46px] text-[15px]',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-[72px] w-[72px] text-2xl',
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;

export interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  /** Força uma cor de fundo (ex. "bg-secondary") em vez da cor por hash do nome. */
  color?: string;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

/**
 * Extraído do padrão initials()/avatarColor() que já existia repetido
 * em perfil/inicio — mesma cor determinística por nome, foto quando
 * existir (photoUrl do worker).
 */
export function Avatar({ name, photoUrl, size = 'md', color, className = '' }: AvatarProps) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-heading font-bold text-background ${color ?? avatarColor(name)} ${SIZE_CLASSES[size]} ${className}`}
    >
      {initials(name)}
    </div>
  );
}
