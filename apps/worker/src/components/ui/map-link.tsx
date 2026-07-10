interface MapLinkProps {
  addressLabel: string;
  lat: number;
  lng: number;
  className?: string;
}

/** Endereço da vaga é texto livre digitado pela empresa — o link usa lat/lng
 * (sempre precisos, vêm da geolocalização) pra garantir que o trabalhador
 * chega no lugar certo mesmo se o texto for vago. */
export function MapLink({ addressLabel, lat, lng, className = '' }: MapLinkProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-start gap-1 text-text-secondary underline decoration-dotted underline-offset-2 hover:text-primary ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path
          d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>{addressLabel}</span>
    </a>
  );
}
