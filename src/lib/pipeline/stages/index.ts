import type { StageName } from "../../types";
import type { StageDef } from "../stage";
import { finalRankStage } from "./finalRank";
import { mediaPrepStage } from "./mediaPrep";
import { prefilterStage } from "./prefilter";
import { selectStage } from "./select";
import { sourceStage } from "./source";
import { textScreenStage } from "./textScreen";
import { videoAnalysisStage } from "./videoAnalysis";

/** Thứ tự chạy được định nghĩa ở STAGES (types.ts); đây chỉ là map tên -> định nghĩa */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STAGE_DEFS: Record<StageName, StageDef<any, any, any>> = {
  source: sourceStage,
  prefilter: prefilterStage,
  text_screen: textScreenStage,
  media_prep: mediaPrepStage,
  video_analysis: videoAnalysisStage,
  final_rank: finalRankStage,
  select: selectStage,
};
