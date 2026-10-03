type IconName = 'logo' | 'scanteie' | 'diamant' | 'misiune' | 'zilnica' | 'incubator';

/** Decorative artwork; the surrounding label names the action or resource. */
export function GameIcon({ name, size = 24, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <img className={`game-icon ${className}`} src={`/icons/ui/${name}.png`} width={size} height={size} alt="" aria-hidden="true" />;
}
