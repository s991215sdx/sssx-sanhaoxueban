import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

export type CoachingDetail = inferRouterOutputs<AppRouter>["coaching"]["detail"];
export type CoachingCases = inferRouterOutputs<AppRouter>["coaching"]["cases"];
export type FamilyFeedback = inferRouterOutputs<AppRouter>["coaching"]["familyFeedback"];
export type CoachingMonthlyPreview = inferRouterOutputs<AppRouter>["coaching"]["monthlyPreview"];
export type CoachingMonthlyReport = inferRouterOutputs<AppRouter>["coaching"]["monthlyReports"][number];
export type CoachingQualityReview = inferRouterOutputs<AppRouter>["coaching"]["qualityReviews"][number];
export type CoachingQualityInboxItem = inferRouterOutputs<AppRouter>["coaching"]["qualityInbox"][number];
