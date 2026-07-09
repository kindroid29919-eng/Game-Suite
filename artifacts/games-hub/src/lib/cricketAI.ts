/**
 * Hand Cricket AI Engine — TypeScript port from Python
 * Classic mode: pattern-based AI
 * Expert mode: multi-model ensemble with adaptive weights
 */

type NumMap = Record<number, number>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function counter(arr: number[]): Record<number, number> {
  const c: Record<number, number> = {};
  for (const n of arr) c[n] = (c[n] || 0) + 1;
  return c;
}

function weightedChoice(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function detectCycle(history: number[], maxCycle = 3): number | null {
  for (let cycleLen = 1; cycleLen <= maxCycle; cycleLen++) {
    const needed = cycleLen * 2;
    if (history.length < needed) continue;
    const recent = history.slice(-needed);
    const first = recent.slice(0, cycleLen);
    const second = recent.slice(cycleLen);
    if (first.every((v, i) => v === second[i])) {
      return history[history.length - cycleLen];
    }
  }
  return null;
}

// ── Classic AI ────────────────────────────────────────────────────────────────

const AI_PATTERNS: Record<number, number[]> = {
  0: [4, 5, 6], 1: [3, 4, 6], 2: [2, 6, 5],
  3: [3, 1, 5], 4: [4, 5, 1], 5: [3, 6, 5], 6: [6, 3, 4],
};

export function aiBowlerChoice(
  batterHistory: number[],
  ownHistory: number[] = [],
  target: number | null = null,
  score = 0,
  ballsRemaining: number | null = null,
): number {
  let base = 0.85;
  if (target !== null && ballsRemaining && ballsRemaining > 0) {
    const rr = (target - score) / (ballsRemaining / 6);
    base = rr >= 5 ? 0.93 : rr <= 2 ? 0.8 : base;
    if (ballsRemaining <= 6 && rr >= 6) base = 0.97;
  }
  const cyclePick = detectCycle(batterHistory);
  if (cyclePick !== null && Math.random() < 0.85) return cyclePick;
  if (ownHistory.length && Math.random() < 0.18) return ownHistory[ownHistory.length - 1];
  if (ownHistory.length && batterHistory.length &&
      batterHistory[batterHistory.length - 1] === ownHistory[ownHistory.length - 1]) {
    let mirrorLen = 0;
    for (let i = 1; i <= Math.min(batterHistory.length, ownHistory.length); i++) {
      if (batterHistory[batterHistory.length - i] === ownHistory[ownHistory.length - i]) mirrorLen++;
      else break;
    }
    if (Math.random() < Math.min(0.9, 0.5 + 0.2 * mirrorLen))
      return ownHistory[ownHistory.length - 1];
  }
  if (batterHistory.length >= 2 &&
      batterHistory[batterHistory.length - 1] === batterHistory[batterHistory.length - 2]) {
    if (Math.random() < 0.8) return batterHistory[batterHistory.length - 1];
  }
  if (batterHistory.length >= 1 && Math.random() < base) {
    const last = batterHistory[batterHistory.length - 1];
    const opts = AI_PATTERNS[last];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  if (batterHistory.length >= 3) {
    const recent = batterHistory.slice(-5);
    const freq = counter(recent);
    const favs = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => Number(k));
    if (favs.length) return favs[Math.floor(Math.random() * favs.length)];
  }
  return Math.floor(Math.random() * 7);
}

export function aiBatterChoice(
  bowlerHistory: number[],
  ownHistory: number[] = [],
  score = 0,
  target: number | null = null,
  ballsRemaining = 0,
  wicketsRemaining = 1,
  totalOvers = 1,
): number {
  const ballsTotal = totalOvers * 6;
  const ballsBowled = ballsTotal - ballsRemaining;
  const oversLeft = ballsRemaining / 6;
  let aggression: number;

  if (target === null) {
    const progress = ballsTotal ? ballsBowled / ballsTotal : 0;
    aggression = 0.3 + 0.5 * progress;
    if (ballsRemaining <= 6) aggression = Math.max(aggression, 0.75);
    if (wicketsRemaining <= 1) aggression *= 0.6;
  } else {
    const rr = oversLeft > 0 ? (target - score) / oversLeft : 99;
    const runsNeeded = target - score;
    if (runsNeeded <= 0) {
      aggression = 0.05;
    } else {
      aggression = Math.min(1.0, Math.max(0.05, rr / 6.0));
      if (rr >= 9) aggression = 0.97;
      else if (rr >= 6.5) aggression = Math.max(aggression, 0.9);
      else if (rr >= 5) aggression = Math.max(aggression, 0.75);
      if (ballsRemaining <= 6 && runsNeeded > 0) {
        const npb = runsNeeded / ballsRemaining;
        if (npb >= 1.5) aggression = 0.97;
        else if (npb >= 1.0) aggression = Math.max(aggression, 0.85);
        else if (npb >= 0.6) aggression = Math.max(aggression, 0.6);
      }
      if (rr <= 2.5 && oversLeft >= 2) aggression = Math.min(aggression, 0.35);
      if (wicketsRemaining <= 1 && rr < 4.5) aggression *= 0.55;
    }
  }
  aggression = Math.max(0, Math.min(1, aggression));

  const weights = Array.from({ length: 7 }, (_, n) =>
    Math.max(1.0 + aggression * n * 1.5 - (1 - aggression) * n * 0.3, 0.05)
  );

  const cyclePick = detectCycle(bowlerHistory);
  if (cyclePick !== null) weights[cyclePick] *= 0.15;
  if (bowlerHistory.length >= 2 &&
      bowlerHistory[bowlerHistory.length - 1] === bowlerHistory[bowlerHistory.length - 2]) {
    weights[bowlerHistory[bowlerHistory.length - 1]] *= 0.1;
  }
  if (bowlerHistory.length && Math.random() < 0.12)
    weights[bowlerHistory[bowlerHistory.length - 1]] *= 1.6;
  if (ownHistory.length && bowlerHistory.length &&
      ownHistory[ownHistory.length - 1] !== bowlerHistory[bowlerHistory.length - 1] &&
      ownHistory[ownHistory.length - 1] >= 4) {
    if (Math.random() < 0.35) weights[ownHistory[ownHistory.length - 1]] *= 1.8;
  }
  if (bowlerHistory.length >= 2) {
    const freq = counter(bowlerHistory.slice(-5));
    const avoidance = aggression < 0.8 ? 0.5 : 0.2;
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([k]) => {
      weights[Number(k)] *= (1 - avoidance);
    });
  }

  return weightedChoice(weights);
}

export function determineDismissalType(number: number, batterHistory: number[]): string {
  if (Math.random() < 0.10) return 'stump_chance';
  if (number >= 4 && number <= 6) {
    const recent = batterHistory.slice(-5);
    const highRatio = recent.length ? recent.filter(n => n >= 4 && n <= 6).length / recent.length : 0;
    if (highRatio >= 0.6 && Math.random() < 0.55) return 'catch_chance';
    return 'bowled';
  } else if (number >= 1 && number <= 3) {
    return 'runout_chance';
  }
  return 'bowled';
}

// ── Expert AI ─────────────────────────────────────────────────────────────────

export type ModelWeights = Record<string, number>;

const MODEL_NAMES = ['markov', 'recent', 'overall', 'pressure', 'psych', 'mirror'] as const;
export type ModelName = typeof MODEL_NAMES[number];

export function newModelWeights(): ModelWeights {
  return Object.fromEntries(MODEL_NAMES.map(n => [n, 1.0]));
}

function dist(scores: NumMap = {}): NumMap {
  const vals = Array.from({ length: 7 }, (_, n) => Math.max(0, scores[n] ?? 0));
  const total = vals.reduce((a, b) => a + b, 0);
  return Object.fromEntries(vals.map((v, n) => [n, total ? v / total : 1 / 7]));
}

function randomness(seq: number[]): number {
  const recent = seq.slice(-18);
  if (recent.length < 8) return 0.0;
  const freq = counter(recent);
  const probs = Object.values(freq).map(v => v / recent.length);
  let entropy = -probs.reduce((s, p) => s + p * Math.log(p + 1e-9), 0) / Math.log(7);
  if (detectCycle(recent, 4) !== null) entropy *= 0.82;
  if (Math.max(...Object.values(freq)) >= recent.length * 0.34) entropy *= 0.82;
  return Math.max(0, Math.min(1, entropy));
}

function blendCounter(scores: NumMap, c: Record<number, number>, scale = 1.0): void {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  if (!total) return;
  for (const [k, v] of Object.entries(c)) scores[Number(k)] = (scores[Number(k)] || 0) + scale * v / total;
}

function recentDistribution(seq: number[]): [NumMap, number] {
  const scores: NumMap = {};
  for (const [w, scale] of [[5, 1.0], [10, 0.9], [20, 0.7], [50, 0.5]] as [number, number][]) {
    const recent = seq.slice(-w);
    if (!recent.length) continue;
    const c = counter(recent);
    for (const [k, v] of Object.entries(c))
      scores[Number(k)] = (scores[Number(k)] || 0) + scale * v / recent.length;
  }
  const conf = Math.min(0.9, 0.18 + 0.72 * Math.min(seq.length, 20) / 20);
  return [dist(scores), conf];
}

function overallDistribution(seq: number[]): [NumMap, number] {
  const conf = Math.min(0.78, 0.12 + 0.66 * Math.min(seq.length, 50) / 50);
  return [dist(counter(seq)), seq.length ? conf : 0.0];
}

function markovDistribution(seq: number[]): [NumMap, number] {
  if (seq.length < 2) return [dist(), 0.0];
  const prev = seq[seq.length - 1];
  const scores: Record<number, number> = {};
  for (let i = 1; i < seq.length; i++) {
    if (seq[i - 1] === prev) scores[seq[i]] = (scores[seq[i]] || 0) + 1;
  }
  const hits = Object.values(scores).reduce((a, b) => a + b, 0);
  const conf = hits ? Math.min(0.98, 0.16 + 0.18 * hits) : 0.0;
  return [dist(scores), conf];
}

interface PsychCtx {
  overall_seq?: number[];
  last_outcome?: string;
  after_boundary?: Record<number, number>;
  after_wicket?: Record<number, number>;
}

function psychologyDistribution(seq: number[], ctx: PsychCtx): [NumMap, number] {
  const scores: NumMap = {};
  const overall = ctx.overall_seq || [];
  const base = seq.length >= 6 ? seq : overall;
  const freq = counter(base);
  const favs = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
  favs.forEach(([n], i) => { scores[Number(n)] = (scores[Number(n)] || 0) + Math.max(0.2, 1.1 - 0.25 * i); });
  const cyc = detectCycle(seq, 4);
  if (cyc !== null) scores[cyc] = (scores[cyc] || 0) + 1.25;
  if (seq.length >= 2 && seq[seq.length - 1] === seq[seq.length - 2])
    scores[seq[seq.length - 1]] = (scores[seq[seq.length - 1]] || 0) + 1.1;
  if (seq.length >= 4 && seq[seq.length - 1] === seq[seq.length - 3] &&
      seq[seq.length - 2] === seq[seq.length - 4])
    scores[seq[seq.length - 2]] = (scores[seq[seq.length - 2]] || 0) + 0.95;
  if (ctx.last_outcome === 'boundary' && ctx.after_boundary)
    blendCounter(scores, ctx.after_boundary, 1.15);
  if (ctx.last_outcome === 'wicket' && ctx.after_wicket)
    blendCounter(scores, ctx.after_wicket, 1.25);
  let conf = 0.15 + 0.15 * (favs.length > 0 ? 1 : 0) + 0.25 * (cyc !== null ? 1 : 0);
  if (seq.length >= 2 && seq[seq.length - 1] === seq[seq.length - 2]) conf += 0.18;
  if (seq.length >= 4 && seq[seq.length - 1] === seq[seq.length - 3] &&
      seq[seq.length - 2] === seq[seq.length - 4]) conf += 0.15;
  conf *= (1 - 0.55 * randomness(seq));
  return [dist(scores), Math.max(0, Math.min(0.9, conf))];
}

interface PressureCtx {
  role?: string;
  target?: number | null;
  score?: number;
  balls_remaining?: number;
  wickets_remaining?: number;
  total_overs?: number;
  last_outcome?: string;
  after_wicket?: Record<number, number>;
}

function pressureDistribution(seq: number[], ctx: PressureCtx): [NumMap, number] {
  const scores: NumMap = {};
  const role = ctx.role;
  const target = ctx.target ?? null;
  const score = ctx.score ?? 0;
  const ballsLeft = Math.max(1, ctx.balls_remaining ?? 0);
  const wkts = Math.max(1, ctx.wickets_remaining ?? 1);
  let urgency: number;
  let conf: number;

  if (role === 'bat') {
    if (target === null) {
      const totalBalls = Math.max(1, (ctx.total_overs ?? 1) * 6);
      const phase = 1 - ballsLeft / totalBalls;
      urgency = Math.max(0.35, Math.min(1.0, 0.35 + 0.6 * phase + (ballsLeft <= 18 ? 0.15 : 0)));
    } else {
      const runsNeeded = Math.max(target - score, 0);
      const rr = runsNeeded / Math.max(ballsLeft / 6, 1 / 6);
      urgency = Math.max(0.15, Math.min(1.0, rr / 6.5));
      if (ballsLeft <= 12 && runsNeeded > 0) urgency = Math.max(urgency, Math.min(1.0, runsNeeded / ballsLeft));
    }
    if (wkts <= 2 && urgency < 0.9) urgency *= 0.78;
    if (urgency >= 0.62) {
      ([[3, 0.45], [4, 0.9], [5, 1.0], [6, 1.15]] as [number, number][]).forEach(([n, w]) => {
        scores[n] = (scores[n] || 0) + w;
      });
      blendCounter(scores, counter(seq.filter(n => n >= 4)), 1.05);
    } else {
      ([[0, 0.2], [1, 1.0], [2, 1.05], [3, 0.8], [4, 0.35]] as [number, number][]).forEach(([n, w]) => {
        scores[n] = (scores[n] || 0) + w;
      });
      blendCounter(scores, counter(seq.filter(n => n <= 3)), 0.9);
    }
    conf = 0.35 + 0.35 * Math.abs(urgency - 0.5);
  } else {
    urgency = 0.3;
    if (target !== null) {
      const runsNeeded = Math.max(target - score, 0);
      urgency = Math.max(0.2, Math.min(1.0, runsNeeded / Math.max(ballsLeft, 1) + (ballsLeft <= 12 ? 0.25 : 0)));
    }
    if (seq.length) scores[seq[seq.length - 1]] = (scores[seq[seq.length - 1]] || 0) + (urgency >= 0.55 ? 0.6 : 0.3);
    blendCounter(scores, counter(seq.slice(-10)), 1.0 + 0.35 * urgency);
    if (ctx.last_outcome === 'wicket' && ctx.after_wicket)
      blendCounter(scores, ctx.after_wicket, 0.8);
    conf = 0.28 + 0.32 * Math.min(1.0, seq.length / 10);
  }
  return [dist(scores), Math.max(0, Math.min(0.82, conf))];
}

function mirrorDistribution(seq: number[], ownSeq: number[]): [NumMap, number] {
  const scores: NumMap = {};
  const window = 14;
  const recentSeq = seq.slice(-window);
  const recentOwn = ownSeq.slice(-(window + 1));
  if (recentSeq.length < 4 || recentOwn.length < 5) return [dist(scores), 0.0];
  const checks = Math.min(recentSeq.length, recentOwn.length - 1);
  let hits = 0;
  for (let i = 1; i <= checks; i++) {
    if (recentSeq[recentSeq.length - i] === recentOwn[recentOwn.length - i - 1]) hits++;
  }
  if (!checks) return [dist(scores), 0.0];
  const copyRate = hits / checks;
  const baseline = 1 / 7;
  if (copyRate >= 0.30 && ownSeq.length) {
    const target = ownSeq[ownSeq.length - 1];
    scores[target] = (scores[target] || 0) + 1.0 + 2.2 * copyRate;
    const conf = Math.max(0, Math.min(0.85, (copyRate - baseline) * 1.35));
    return [dist(scores), conf];
  }
  return [dist(scores), 0.0];
}

export interface ExpertCtx {
  role: 'bat' | 'bowl';
  score: number;
  target: number | null;
  balls_remaining: number;
  wickets_remaining: number;
  total_overs: number;
  last_outcome?: string;
  after_boundary?: Record<number, number>;
  after_wicket?: Record<number, number>;
  overall_seq: number[];
  own_seq: number[];
}

export interface ExpertState {
  weights: { bat: ModelWeights; bowl: ModelWeights };
  lastDists: { bat: Record<string, NumMap> | null; bowl: Record<string, NumMap> | null };
}

export function newExpertState(): ExpertState {
  return {
    weights: { bat: newModelWeights(), bowl: newModelWeights() },
    lastDists: { bat: null, bowl: null },
  };
}

function expertPredict(
  seq: number[],
  ctx: ExpertCtx,
  state: ExpertState,
  globalSeed: number[] = [],
): [NumMap, Record<string, number>] {
  const role = ctx.role;
  const rand = randomness(seq);
  const overallSeq = ctx.overall_seq.length < 25 ? [...ctx.overall_seq, ...globalSeed.slice(0, 300)] : ctx.overall_seq;

  const rawDists: Record<string, [NumMap, number]> = {
    markov: markovDistribution(seq),
    recent: recentDistribution(seq),
    overall: overallDistribution(overallSeq.length ? overallSeq : seq),
    pressure: pressureDistribution(seq, ctx),
    psych: psychologyDistribution(seq, { overall_seq: ctx.overall_seq, last_outcome: ctx.last_outcome, after_boundary: ctx.after_boundary, after_wicket: ctx.after_wicket }),
    mirror: mirrorDistribution(seq, ctx.own_seq),
  };

  const flavor: Record<string, number> = {
    markov: 1 - 0.15 * rand, recent: 1 + 0.08 * rand,
    overall: 1 + 0.25 * rand, pressure: 1.0,
    psych: 1 - 0.5 * rand, mirror: 1.0,
  };

  const dynWeights = state.weights[role];
  const totalDyn = Object.values(dynWeights).reduce((a, b) => a + b, 0) || 1.0;
  const scores: NumMap = {};
  const confidences: Record<string, number> = {};

  for (const [name, [d, conf]] of Object.entries(rawDists)) {
    confidences[name] = Math.round(conf * 1000) / 1000;
    const weight = (dynWeights[name] / totalDyn) * (flavor[name] || 1.0);
    for (const [nStr, p] of Object.entries(d)) {
      const n = Number(nStr);
      scores[n] = (scores[n] || 0) + weight * Math.max(0.05, conf) * p;
    }
  }

  state.lastDists[role] = Object.fromEntries(Object.entries(rawDists).map(([k, [d]]) => [k, d]));
  return [dist(scores), confidences];
}

export function updateModelWeights(
  role: 'bat' | 'bowl',
  actual: number,
  state: ExpertState,
): void {
  const dists = state.lastDists[role];
  if (!dists) return;
  const weights = state.weights[role];
  const eta = 0.55;
  const baseline = 1 / 7;
  for (const [name, d] of Object.entries(dists)) {
    const prob = Math.max(1e-6, d[actual] ?? baseline);
    const relative = prob / baseline;
    const w = (weights[name] || 1.0) * Math.pow(relative, eta);
    weights[name] = Math.max(0.05, Math.min(8.0, w));
  }
}

export function expertBowlerChoice(
  playerHistory: number[],
  ownHistory: number[] = [],
  ctx: ExpertCtx,
  state: ExpertState,
): number {
  const ctxWithOwn: ExpertCtx = { ...ctx, own_seq: ownHistory };
  const [prediction] = expertPredict(playerHistory, ctxWithOwn, state);
  const ranked = Object.entries(prediction).sort((a, b) => b[1] - a[1]).map(([k]) => Number(k));
  if (playerHistory.length < 3) {
    const top = ranked.slice(0, 3);
    const ws = top.map(n => prediction[n]);
    return top[weightedChoice(ws)];
  }
  let choice = ranked[0];
  if (ownHistory.length >= 4 && ownHistory.slice(-4).every(x => x === choice) && ranked.length > 1)
    choice = ranked[1];
  return choice;
}

export function expertBatterChoice(
  playerHistory: number[],
  ownHistory: number[] = [],
  score: number,
  target: number | null,
  ballsRemaining: number,
  wicketsRemaining: number,
  totalOvers: number,
  ctx: ExpertCtx,
  state: ExpertState,
): number {
  const bowlCtx: ExpertCtx = {
    ...ctx,
    role: 'bowl',
    score, target, balls_remaining: ballsRemaining,
    wickets_remaining: wicketsRemaining, total_overs: totalOvers,
    own_seq: ownHistory,
  };
  const [prediction] = expertPredict(playerHistory, bowlCtx, state);

  let aggression: number;
  if (target === null) {
    const phase = 1 - ballsRemaining / Math.max(1, totalOvers * 6);
    aggression = Math.max(0.4, Math.min(1.0, 0.4 + 0.55 * phase + (ballsRemaining <= 18 ? 0.2 : 0)));
  } else {
    const runsNeeded = Math.max(target - score, 0);
    if (runsNeeded <= 0) return 0;
    const rr = runsNeeded / Math.max(ballsRemaining / 6, 1 / 6);
    aggression = Math.max(0.25, Math.min(1.0, rr / 6.0));
    if (ballsRemaining <= 12)
      aggression = Math.max(aggression, Math.min(1.0, runsNeeded / Math.max(ballsRemaining, 1)));
  }
  if (wicketsRemaining <= 2 && aggression < 0.9) aggression *= 0.72;

  const weights: NumMap = {
    0: 0.05,
    1: 0.3 + 0.1 * (1 - aggression),
    2: 0.45 + 0.1 * (1 - aggression),
    3: 0.55,
    4: 0.7 + 0.5 * aggression,
    5: 0.75 + 0.65 * aggression,
    6: 0.7 + 0.85 * aggression,
  };

  const ranked = Object.entries(prediction).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([nStr, p], rank) => {
    const n = Number(nStr);
    const danger = p * (rank === 0 ? 2.5 : rank === 1 ? 1.8 : 1.0);
    weights[n] = Math.max(0.01, (weights[n] || 0.05) * Math.max(0.01, 1.0 - danger * 1.6));
  });

  if (ownHistory.length) {
    const last = ownHistory[ownHistory.length - 1];
    if ((prediction[last] ?? 0) >= 0.18)
      weights[last] = Math.max(0.005, (weights[last] || 0.01) * 0.1);
  }

  const ws = Array.from({ length: 7 }, (_, n) => Math.max(weights[n] ?? 0, 0.005));
  return weightedChoice(ws);
}
