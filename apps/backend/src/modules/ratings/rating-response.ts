import { ratings } from '../../db/schema';

type RatingRow = typeof ratings.$inferSelect;

export interface RatingResponse {
  id: string;
  shiftId: string;
  raterRole: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export function toRatingResponse(rating: RatingRow): RatingResponse {
  return {
    id: rating.id,
    shiftId: rating.shiftId,
    raterRole: rating.raterRole,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt,
  };
}
