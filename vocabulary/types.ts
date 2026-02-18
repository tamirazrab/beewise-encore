export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type PracticeType = "speaking" | "listening";
export type FavoriteType = "vocabulary" | "quiz";

export interface VocabularyItem {
  id: string;
  language_code: string;
  difficulty_level: DifficultyLevel;
  word: string;
  meaning: string;
  example_sentence: string | null;
  audio_url: string | null;
  created_at: Date;
}

export interface UserVocabularyProgress {
  user_id: string;
  vocabulary_id: string;
  mastery_level: number;
  last_practiced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  type: PracticeType;
  language_code: string;
  created_at: Date;
}

export interface PracticeRecording {
  id: string;
  session_id: string;
  s3_key: string;
  duration_seconds: number | null;
  pronunciation_score: number | null;
  ai_feedback: Record<string, any> | null;
  created_at: Date;
}

export interface Quiz {
  id: string;
  language_code: string;
  difficulty_level: DifficultyLevel;
  created_at: Date;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  created_at: Date;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  completed_at: Date;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  item_type: FavoriteType;
  item_id: string;
  created_at: Date;
}
