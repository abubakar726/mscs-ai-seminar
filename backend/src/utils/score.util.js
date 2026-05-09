/**
 * Score-Based Priority Calculator
 *
 * Rules:
 * - First time speaking: +50 points
 * - Each previous speaking turn: -15 points
 * - Teacher role: +20 bonus points
 * - Same score group: FIFO (requestedAt tiebreaker)
 */

function calculateScore(participant) {
  let score = 0;

  // First time speaking bonus
  if (participant.speakCount === 0) {
    score += 50;
  }

  // Deduct for each previous speaking turn
  score -= participant.speakCount * 15;

  // Teacher bonus
  if (participant.role === 'teacher') {
    score += 20;
  }

  return score;
}

/**
 * Sort queue by priority score (highest first)
 * Tiebreaker: requestedAt (FIFO)
 */
function sortQueue(queueEntries) {
  return [...queueEntries]
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore; // highest score first
      }
      return new Date(a.requestedAt) - new Date(b.requestedAt); // FIFO tiebreaker
    });
}

/**
 * Get next speaker from queue
 */
function getNextSpeaker(queueEntries) {
  const sorted = sortQueue(queueEntries);
  return sorted.length > 0 ? sorted[0] : null;
}

module.exports = { calculateScore, sortQueue, getNextSpeaker };
