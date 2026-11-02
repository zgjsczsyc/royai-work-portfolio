export interface Evidence { postId: string; role: string; quote: string }
export interface Post { id: string; platform: string; title: string; text: string; url: string; authorName: string | null; publishedAt: string | null; collectedAt: string; method: string; metrics: Record<string, number | null> }
export interface Heat { platform: string; score: number | null; baseline: string; sampleSize: number; weightCoverage: number; missing: string[]; raw: { posts: number; authors: number | null; growth: number | null; completeness: number; interactions: Record<string, number | null> } }
export interface RadarEvent {
  id: string; title: string; summary: string; product: string; categories: string[]; platforms: string[];
  sentiment: string; sentimentTarget: string; direction: string; relevance: number; impact: number; priority: number;
  heatScore: number | null; heat: Heat[]; confidence: string; evidence: Evidence[]; relevanceReason: string; impactReason: string;
  impactDimensions: Record<string, number>; action: string; verify: string; timeline: { at: string; label: string; evidenceIds: string[] }[];
  gameName?: string; releaseStage?: string; releaseDate?: string; tournamentName?: string; stage?: string; matchAt?: string; matchTimePrecision?: string; eventType?: string; relationshipBasis?: string;
}
export interface Source { platform: string; status: string; count: number; notes: string[]; method: string; query: string | null }
export interface Run { id: string; status: string; startedAt: string; finishedAt?: string; count?: number; method: string; sources?: Source[] }
export interface Analysis { id: string; mode: string; generatedAt: string; sourceCutoff: string; events: RadarEvent[]; posts: Post[]; scoreVersion: string; sources: Source[]; excludedPostIds: string[]; limitations?: string[] }
export interface State { mode: string; latestRun: Run | null; sources: Source[]; analysis: Analysis | null; categories: string[]; analysisPending: boolean; sections: { title: string; events: RadarEvent[] }[]; verifiedRuns: Record<string, number>; runs: Run[]; snapshot?: { createdAt: string; inputPosts: number; excludedPosts: number } }
