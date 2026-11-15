import { MINNA_LESSONS_PART1, type MinnaLesson } from "./minnaNoNihongoPart1";
import { MINNA_LESSONS_PART2 } from "./minnaNoNihongoPart2";
import { MINNA_LESSONS_PART3 } from "./minnaNoNihongoPart3";

export type {
  MinnaDialogueLine,
  MinnaGrammarPoint,
  MinnaLesson,
  MinnaQuizQuestion,
  MinnaVocabItem,
} from "./minnaNoNihongoPart1";

export const MINNA_LESSONS: MinnaLesson[] = [
  ...MINNA_LESSONS_PART1,
  ...MINNA_LESSONS_PART2,
  ...MINNA_LESSONS_PART3,
];
