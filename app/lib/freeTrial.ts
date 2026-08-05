import { getLocalStorage, setLocalStorage } from '~/lib/persistence/localStorage';

export const FREE_GENERATION_LIMIT = 3;

const FREE_GENERATIONS_USED_KEY = 'coralred_free_generations_used';

export function getFreeGenerationsUsed(): number {
  const value = getLocalStorage(FREE_GENERATIONS_USED_KEY);
  return typeof value === 'number' && value > 0 ? value : 0;
}

export function getFreeGenerationsRemaining(): number {
  return Math.max(FREE_GENERATION_LIMIT - getFreeGenerationsUsed(), 0);
}

export function hasFreeGenerationsRemaining(): boolean {
  return getFreeGenerationsRemaining() > 0;
}

export function incrementFreeGenerationsUsed(): number {
  const next = getFreeGenerationsUsed() + 1;
  setLocalStorage(FREE_GENERATIONS_USED_KEY, next);

  return next;
}
