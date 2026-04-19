export interface ScoreUpdateMessage {
  matchId: number;
  score_home: number;
  score_away: number;
  timestamp: number;
}

export type ValidationResult =
  | { valid: false; error: string }
  | { valid: true; message: ScoreUpdateMessage };

export function validateScoreUpdateMessage(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Message must be an object' };
  }

  const msg = data as Record<string, unknown>;

  if (typeof msg.matchId !== 'number' || msg.matchId <= 0) {
    return { valid: false, error: 'matchId must be a positive number' };
  }

  if (typeof msg.score_home !== 'number' || msg.score_home < 0) {
    return { valid: false, error: 'score_home must be a non-negative number' };
  }

  if (typeof msg.score_away !== 'number' || msg.score_away < 0) {
    return { valid: false, error: 'score_away must be a non-negative number' };
  }

  if (typeof msg.timestamp !== 'number' || msg.timestamp <= 0) {
    return { valid: false, error: 'timestamp must be a positive number' };
  }

  const validatedMessage: ScoreUpdateMessage = {
    matchId: msg.matchId as number,
    score_home: msg.score_home as number,
    score_away: msg.score_away as number,
    timestamp: msg.timestamp as number,
  };

  return { valid: true, message: validatedMessage };
}

export function serializeMessage(message: ScoreUpdateMessage): string {
  return JSON.stringify(message);
}

export function deserializeMessage(
  data: string
):
  | { success: false; error: string }
  | { success: true; message: ScoreUpdateMessage } {
  try {
    const parsed = JSON.parse(data);
    const validation = validateScoreUpdateMessage(parsed);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return { success: true, message: validation.message };
  } catch (err) {
    return { success: false, error: `Failed to parse JSON: ${(err as Error).message}` };
  }
}
