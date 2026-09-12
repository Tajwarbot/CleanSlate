/**
 * CleanSlate State Machine
 *
 * Deterministic, explicit state machine for operation lifecycle.
 * Every transition is defined in the transition table.
 * Unlisted transitions are rejected (fail-closed).
 */

import {
  OperationState,
  StateEvent,
  STATE_TRANSITIONS,
  type StateChangeListener,
} from '../../types/state';
import { InvalidTransitionError } from '../errors/errors';
import { logger } from '../logging/logger';

export class StateMachine {
  private currentState: OperationState;
  private readonly listeners: Set<StateChangeListener> = new Set();
  private readonly transitionMap: Map<string, OperationState>;
  private readonly history: Array<{
    from: OperationState;
    event: StateEvent;
    to: OperationState;
    timestamp: number;
  }> = [];

  constructor(initialState: OperationState = OperationState.Idle) {
    this.currentState = initialState;

    // Pre-compute transition lookup map for O(1) lookups
    this.transitionMap = new Map();
    for (const transition of STATE_TRANSITIONS) {
      const key = this.transitionKey(transition.from, transition.event);
      this.transitionMap.set(key, transition.to);
    }

    logger.info('State machine initialized', {
      context: { initialState },
    });
  }

  /** Get the current state */
  getState(): OperationState {
    return this.currentState;
  }

  /**
   * Process an event and transition to the next state.
   * Throws InvalidTransitionError if the transition is not allowed.
   */
  transition(event: StateEvent): OperationState {
    const key = this.transitionKey(this.currentState, event);
    const nextState = this.transitionMap.get(key);

    if (nextState === undefined) {
      const error = new InvalidTransitionError(this.currentState, event);
      logger.error('Invalid state transition attempted', {
        errorCode: error.code,
        context: {
          currentState: this.currentState,
          event,
        },
      });
      throw error;
    }

    const previousState = this.currentState;
    this.currentState = nextState;

    // Record in history
    this.history.push({
      from: previousState,
      event,
      to: nextState,
      timestamp: Date.now(),
    });

    // Keep history bounded
    if (this.history.length > 100) {
      this.history.splice(0, this.history.length - 100);
    }

    logger.info('State transition', {
      phase: 'state_change',
      context: {
        from: previousState,
        event,
        to: nextState,
      },
    });

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(previousState, nextState, event);
      } catch (err) {
        logger.error('State change listener error', {
          context: {
            error: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    }

    return nextState;
  }

  /**
   * Check if a transition is valid without executing it.
   */
  canTransition(event: StateEvent): boolean {
    const key = this.transitionKey(this.currentState, event);
    return this.transitionMap.has(key);
  }

  /**
   * Get all valid events for the current state.
   */
  getValidEvents(): ReadonlyArray<StateEvent> {
    const events: StateEvent[] = [];
    for (const event of Object.values(StateEvent)) {
      if (this.canTransition(event)) {
        events.push(event);
      }
    }
    return events;
  }

  /** Register a listener for state changes */
  addListener(listener: StateChangeListener): void {
    this.listeners.add(listener);
  }

  /** Remove a state change listener */
  removeListener(listener: StateChangeListener): void {
    this.listeners.delete(listener);
  }

  /** Get transition history */
  getHistory(): ReadonlyArray<{
    from: OperationState;
    event: StateEvent;
    to: OperationState;
    timestamp: number;
  }> {
    return [...this.history];
  }

  /**
   * Force reset to IDLE state.
   * Only for recovery situations — NOT for normal operation flow.
   */
  forceReset(): void {
    const previousState = this.currentState;
    this.currentState = OperationState.Idle;
    logger.warn('State machine force-reset to IDLE', {
      context: { previousState },
    });
  }

  /** Check if the machine is in an error state */
  isInErrorState(): boolean {
    return [
      OperationState.SecurityChallenge,
      OperationState.RateLimited,
      OperationState.ActionFailed,
      OperationState.UIChanged,
      OperationState.UnknownState,
    ].includes(this.currentState);
  }

  /** Check if the machine is in an active (destructive) state */
  isActive(): boolean {
    return [OperationState.Executing, OperationState.Verifying].includes(this.currentState);
  }

  private transitionKey(state: OperationState, event: StateEvent): string {
    return `${state}::${event}`;
  }
}
