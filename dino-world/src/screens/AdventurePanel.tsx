// Arena are dueluri, avanpostul are expediții. (Echipele plecate în misiunile vechi, din salvări vechi,
// se văd ca active în aceste panouri și se revendică la fel.)
import type { Building } from '@shared/game';
import { ExpeditionPanel } from './ExpeditionPanel';
import { ArenaPanel } from './ArenaPanel';
import type { Game } from '../hooks/useGame';

export function AdventurePanel({ game, building }: { game: Game; building: Building }) {
  return building.kind === 'arena' ? (
    <ArenaPanel game={game} building={building} />
  ) : (
    <ExpeditionPanel game={game} building={building} />
  );
}
