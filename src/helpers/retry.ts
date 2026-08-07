const BASE_DELAY = 1000;

/**
 * The longest a retry ever waits. Retries are not capped in number, only in
 * frequency: a page that cannot be loaded keeps trying for as long as it is on
 * screen, because nothing on the client can know when a source recovers. The
 * ceiling is what keeps that from being a burden - two failed pages settle at
 * four requests a minute between them.
 */
const MAX_DELAY = 30_000;

/**
 * How long to wait before the next attempt, given how many have already
 * failed. Doubles until it reaches the ceiling, so a brief outage recovers
 * quickly while a lasting one settles into a trickle.
 *
 * @param {number} attempts Failures so far, at least 1 when a retry is due.
 * @returns {number} Delay in milliseconds.
 */
export function retry_delay(attempts: number): number {
    return Math.min(BASE_DELAY * 2 ** Math.max(attempts - 1, 0), MAX_DELAY);
}
