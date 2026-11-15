import { JLPT_N5_N4_EXAMS } from "@/data/jlptN5N4";
import { JLPT_N3_N2_N1_EXAMS } from "@/data/jlptN3N2N1";
import { JLPT_N5_FULL_EXAM } from "@/data/jlptFullN5";
import { JLPT_N4_FULL_EXAM } from "@/data/jlptFullN4";
import { JLPT_N3_FULL_EXAM } from "@/data/jlptFullN3";
import { JLPT_N2_FULL_EXAM } from "@/data/jlptFullN2";
import { JLPT_N1_FULL_EXAM } from "@/data/jlptFullN1";
import type { JlptExamPaper } from "@/data/jlptTypes";

export * from "@/data/jlptTypes";

export const JLPT_EXAMS: JlptExamPaper[] = [
  JLPT_N5_FULL_EXAM,
  JLPT_N4_FULL_EXAM,
  JLPT_N3_FULL_EXAM,
  JLPT_N2_FULL_EXAM,
  JLPT_N1_FULL_EXAM,
  ...JLPT_N5_N4_EXAMS,
  ...JLPT_N3_N2_N1_EXAMS,
];

export function getJlptExamById(id: string): JlptExamPaper | undefined {
  return JLPT_EXAMS.find((e) => e.id === id);
}
