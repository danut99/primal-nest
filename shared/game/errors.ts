export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_ITEMS'
  | 'INSUFFICIENT_FUNDS'
  | 'NOT_READY'
  | 'BUSY'
  | 'LOCKED'
  | 'FULL';

/** Eroare de regulă de joc, cu mesaj gata de afișat jucătorului. */
export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}
