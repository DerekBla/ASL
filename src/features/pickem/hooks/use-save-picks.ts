"use client";

import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { ActionResult } from "@/lib/types/result";

import { savePicksAction } from "../actions/save-picks";
import type { SavePicksActionInput, SavedBracket } from "../actions/save-picks";

/** Saves a bracket. The page is refreshed by the caller, so there is no cache to invalidate. */
export function useSavePicks(): UseMutationResult<
  ActionResult<SavedBracket>,
  Error,
  SavePicksActionInput
> {
  return useMutation({ mutationFn: (input: SavePicksActionInput) => savePicksAction(input) });
}
