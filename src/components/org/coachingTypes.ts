import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

export type CoachingDetail = inferRouterOutputs<AppRouter>["coaching"]["detail"];
export type CoachingCases = inferRouterOutputs<AppRouter>["coaching"]["cases"];
export type FamilyFeedback = inferRouterOutputs<AppRouter>["coaching"]["familyFeedback"];
