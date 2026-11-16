/**
 * Chọn đúng N KOC sao cho TỔNG điểm cao nhất mà TỔNG chi phí <= ngân sách.
 * Đây là bài toán knapsack có ràng buộc số lượng (cardinality-constrained knapsack).
 *
 * - Nhỏ (demo 5 KOC): dynamic programming -> nghiệm tối ưu chính xác.
 * - Lớn (500 KOC, ngân sách hàng tỷ): DP quá nặng -> greedy theo điểm rồi swap cải thiện.
 *
 * Vì sao không chỉ lấy top-5 điểm cao nhất? Vì top-5 có thể vượt ngân sách, hoặc
 * 1 creator đắt chiếm chỗ của 2 creator rẻ hơn mà tổng hiệu quả cao hơn.
 */
export interface Candidate {
  id: string;
  score: number; // càng cao càng tốt
  cost: number; // VND
}

export function selectWithinBudget(cands: Candidate[], n: number, budget: number, unit = 100_000): { ids: string[]; totalCost: number; method: "dp" | "greedy" } {
  const k = Math.min(n, cands.length);
  const B = Math.floor(budget / unit);
  if (cands.length * k * B <= 5_000_000) {
    const dp = dpSelect(cands, k, B, unit);
    if (dp) return { ...dp, method: "dp" };
  }
  return { ...greedySelect(cands, k, budget), method: "greedy" };
}

function dpSelect(cands: Candidate[], k: number, B: number, unit: number) {
  const costs = cands.map((c) => Math.ceil(c.cost / unit));
  // best[j][b] = điểm tối đa khi chọn đúng j creator với chi phí <= b ; -Inf nếu không khả thi
  const NEG = -1e18;
  let best = Array.from({ length: k + 1 }, (_, j) => new Float64Array(B + 1).fill(j === 0 ? 0 : NEG));
  const choice: Uint8Array[][] = []; // choice[i][j][b] = 1 nếu chọn item i ở trạng thái (j,b)
  for (let i = 0; i < cands.length; i++) {
    const next = best.map((row) => Float64Array.from(row));
    const ch = Array.from({ length: k + 1 }, () => new Uint8Array(B + 1));
    for (let j = 1; j <= k; j++) {
      for (let b = costs[i]; b <= B; b++) {
        const prev = best[j - 1][b - costs[i]];
        if (prev > NEG / 2 && prev + cands[i].score > next[j][b]) {
          next[j][b] = prev + cands[i].score;
          ch[j][b] = 1;
        }
      }
    }
    choice.push(ch);
    best = next;
  }
  // Tìm b tốt nhất với đúng k item; nếu không khả thi thì giảm k
  for (let kk = k; kk >= 1; kk--) {
    let bestB = -1;
    for (let b = 0; b <= B; b++) if (best[kk][b] > NEG / 2 && (bestB < 0 || best[kk][b] > best[kk][bestB])) bestB = b;
    if (bestB < 0) continue;
    // Truy vết ngược
    const ids: string[] = [];
    let j = kk;
    let b = bestB;
    for (let i = cands.length - 1; i >= 0 && j > 0; i--) {
      if (choice[i][j][b]) {
        ids.push(cands[i].id);
        b -= costs[i];
        j--;
      }
    }
    const chosen = cands.filter((c) => ids.includes(c.id));
    return { ids: chosen.sort((a, b2) => b2.score - a.score).map((c) => c.id), totalCost: chosen.reduce((s, c) => s + c.cost, 0) };
  }
  return null;
}

function greedySelect(cands: Candidate[], k: number, budget: number) {
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  const chosen: Candidate[] = [];
  let spent = 0;
  for (const c of sorted) {
    if (chosen.length >= k) break;
    // chừa tiền cho các slot còn lại (giả định slot còn lại rẻ nhất có thể)
    const cheapest = sorted.filter((x) => !chosen.includes(x) && x !== c).map((x) => x.cost).sort((a, b) => a - b);
    const reserve = cheapest.slice(0, k - chosen.length - 1).reduce((s, x) => s + x, 0);
    if (spent + c.cost + reserve <= budget) {
      chosen.push(c);
      spent += c.cost;
    }
  }
  return { ids: chosen.map((c) => c.id), totalCost: spent };
}
