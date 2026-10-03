import type { Diet, ItemId } from '@shared/game';

function AssetIcon({ category, id, size, className }: { category: 'items' | 'relics' | 'eggs'; id: string; size: number; className: string }) {
  return <img className={`game-icon asset-icon ${className}`} src={`/art/${category}/${id}.png`} width={size} height={size} alt="" aria-hidden="true" />;
}

export function EggIcon({ size = 24 }: { size?: number }) {
  return <AssetIcon category="eggs" id="jungla" size={size} className="" />;
}

export function ItemArt({ item, size = 24, className = '' }: { item: ItemId; size?: number; className?: string }) {
  return <AssetIcon category="items" id={item} size={size} className={className} />;
}

export function RelicIcon({ relic, size = 32, className = '' }: { relic: string; size?: number; className?: string }) {
  return <AssetIcon category="relics" id={relic} size={size} className={className} />;
}

const DIET_ITEM: Record<Diet, ItemId> = { plante: 'ferigi', carne: 'carne', insecte: 'insecte' };
export function DietArt({ diet, size = 24 }: { diet: Diet; size?: number }) {
  return <ItemArt item={DIET_ITEM[diet]} size={size} />;
}
