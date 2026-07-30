/**
 * Writing prompts.
 *
 * Plain local data — no network, no AI required. Prompts are suggestions to help
 * someone start; they are never inserted into a letter without being asked for.
 */

import type { LetterCategory } from '../storage/schema';

export interface Prompt {
  id: string;
  category: LetterCategory | 'any';
  text: string;
}

export const PROMPTS: Prompt[] = [
  { id: 'p1', category: 'any', text: 'What made you think of them today?' },
  { id: 'p2', category: 'any', text: 'Describe the room you are writing this in.' },
  { id: 'p3', category: 'any', text: 'What do you hope they remember about this time?' },
  { id: 'p4', category: 'love', text: 'What small, ordinary thing about them do you love most?' },
  { id: 'p5', category: 'love', text: 'Write about the moment you knew.' },
  { id: 'p6', category: 'family', text: 'What family story do you want kept?' },
  { id: 'p7', category: 'family', text: 'What did you learn from them without being taught?' },
  { id: 'p8', category: 'friendship', text: 'What has this friendship survived?' },
  { id: 'p9', category: 'friendship', text: 'Recall the day you both still laugh about.' },
  { id: 'p10', category: 'gratitude', text: 'Name the thing they did that they may not remember doing.' },
  { id: 'p11', category: 'gratitude', text: 'What is easier in your life because of them?' },
  { id: 'p12', category: 'apology', text: 'Say plainly what happened, without explaining it away.' },
  { id: 'p13', category: 'apology', text: 'What will you do differently, concretely?' },
  { id: 'p14', category: 'milestone', text: 'What were they like just before this began?' },
  { id: 'p15', category: 'milestone', text: 'What do you want them to know on this day?' },
  { id: 'p16', category: 'future-self', text: 'What are you worried about that may turn out fine?' },
  { id: 'p17', category: 'future-self', text: 'Describe your ordinary day, so you can remember it.' },
  { id: 'p18', category: 'future-self', text: 'What would you like to have kept doing by then?' },
  { id: 'p19', category: 'farewell', text: 'What do you want to say while there is still time?' },
  { id: 'p20', category: 'farewell', text: 'What of theirs will you carry on?' },
  { id: 'p21', category: 'everyday', text: 'What did you eat, hear and notice today?' },
  { id: 'p22', category: 'everyday', text: 'What is the smallest good thing that happened this week?' },
  { id: 'p23', category: 'other', text: 'Begin with the sentence you keep not saying.' },
  { id: 'p24', category: 'any', text: 'What would you want to read, if this letter were for you?' },
];

export function promptsFor(category: LetterCategory): Prompt[] {
  const matching = PROMPTS.filter((prompt) => prompt.category === category);
  const general = PROMPTS.filter((prompt) => prompt.category === 'any');
  return [...matching, ...general];
}

/**
 * Picks a prompt that is not the one currently shown, deterministically when a
 * random source is supplied — which is what the tests use.
 */
export function nextPrompt(
  category: LetterCategory,
  currentId: string | null,
  random: () => number = Math.random,
): Prompt {
  const pool = promptsFor(category).filter((prompt) => prompt.id !== currentId);
  const list = pool.length > 0 ? pool : promptsFor(category);
  const index = Math.min(list.length - 1, Math.floor(random() * list.length));
  return list[index]!;
}
