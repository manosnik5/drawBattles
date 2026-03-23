import { ALL_THEMES } from "../constants"

export function pickRandomThemes(count = 3): string[] {
  const shuffled = [...ALL_THEMES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}