import type { Building, GameState } from './types';

export interface BuildingPosition {
  x: number;
  y: number;
}
export const MAIN_BUILDING_POSITIONS: Record<string, BuildingPosition & { scale: number }> = {
  arena: { x: 980, y: 700, scale: 1.25 },
  outpost: { x: 430, y: 330, scale: 1.15 },
  p0: { x: 775, y: 320, scale: 1.15 },
  p1: { x: 395, y: 500, scale: 1.15 },
  p2: { x: 1140, y: 555, scale: 1.15 },
  p3: { x: 740, y: 520, scale: 1.15 },
  p4: { x: 550, y: 710, scale: 1.15 },
  hatchery: { x: 775, y: 310, scale: 1.05 },
  den: { x: 1100, y: 360, scale: 1.05 },
};
export function buildingPosition(b: Building) {
  const initial = MAIN_BUILDING_POSITIONS[b.slot] ?? { x: 768, y: 470, scale: 1.15 };
  return { ...initial, ...b.position };
}
/** Mărimea unei clădiri noi, așezate liber (cea a clădirilor fără loc prestabilit). */
export const FREE_BUILDING_SCALE = 1.15;

/** Keep the building's base on the walkable surface, away from cliffs and other bases. */
export function buildingPositionError(state: GameState, id: string, p: BuildingPosition): string | null {
  const building = state.buildings.find((b) => b.id === id);
  if (!building || building.kind === 'habitat') return 'Alege o clădire de pe insula principală.';
  return positionError(state, p, buildingPosition(building).scale, id);
}

/** Poate sta o clădire de mărimea `scale` la `p`? `ignore` = clădirea care se mută. null = da. */
export function positionError(state: GameState, p: BuildingPosition, scale: number, ignore?: string): string | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return 'Poziție invalidă.';
  if (((p.x - 768) / (700 - 95 * scale)) ** 2 + ((p.y - 470) / (340 - 40 * scale)) ** 2 > 1)
    return 'Alege un loc pe suprafața insulei.';
  if (
    state.buildings.some((b) => {
      if (b.id === ignore || b.kind === 'habitat') return false;
      const other = buildingPosition(b),
        sum = scale + other.scale;
      return ((p.x - other.x) / (95 * sum)) ** 2 + ((p.y - other.y) / (48 * sum)) ** 2 < 1;
    })
  )
    return 'Locul este prea aproape de altă clădire.';
  return null;
}
