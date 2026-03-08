import { isCancel } from '@clack/prompts';
import pc from 'picocolors';

export const BACK = Symbol('BACK');
export type BackSignal = typeof BACK;

/**
 * Checks whether a clack prompt result was cancelled (Ctrl+C / Esc).
 * Returns BACK when cancelled; otherwise returns the original value.
 */
export function handleCancel<T>(value: T | symbol): T | BackSignal {
  if (isCancel(value)) return BACK;
  return value as T;
}

export type Step<S> = (state: Partial<S>) => Promise<Partial<S> | BackSignal | null>;

/**
 * Runs sequential steps with backward navigation.
 * Ctrl+C/Esc on any step moves back to the previous step.
 * On the first step, it cancels the wizard.
 */
export async function runSteps<S>(steps: Step<S>[], initialState: Partial<S> = {}): Promise<S | null> {
  const stateHistory: Partial<S>[] = [{ ...initialState }];
  let index = 0;

  while (index < steps.length) {
    const currentState = { ...stateHistory[index]! };
    const result = await steps[index]!(currentState);

    if (result === BACK) {
      if (index === 0) return null;
      index--;
      continue;
    }

    if (result === null) return null;

    const merged = { ...currentState, ...result };
    stateHistory[index + 1] = merged;
    index++;
  }

  return stateHistory[index] as S;
}
