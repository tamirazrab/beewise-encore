import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { vocabularyDB } from "./db";
import { generateS3Key, generateUploadSignedUrl, generateDownloadSignedUrl } from "./s3";
import type {
  VocabularyItem,
  UserVocabularyProgress,
  PracticeSession,
  PracticeRecording,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  FavoriteItem,
  DifficultyLevel,
  PracticeType,
  FavoriteType,
} from "./types";

function requireUserID(): string {
  const auth = getAuthData();
  if (!auth?.userID) throw APIError.unauthenticated("User ID not found");
  return auth.userID;
}

export const listVocabulary = api(
  { method: "GET", path: "/vocabulary", auth: true },
  async (
    req: {
      language_code?: string;
      difficulty_level?: DifficultyLevel;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: VocabularyItem[]; total: number }> => {
    const userID = requireUserID();
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const items: VocabularyItem[] = [];
    let rows: AsyncIterable<VocabularyItem>;

    if (req.language_code && req.difficulty_level) {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
          AND difficulty_level = ${req.difficulty_level}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (req.language_code) {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (req.difficulty_level) {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND difficulty_level = ${req.difficulty_level}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    for await (const item of rows) {
      items.push(item);
    }

    let totalRow: { count: number } | null;

    if (req.language_code && req.difficulty_level) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
          AND difficulty_level = ${req.difficulty_level}
      `;
    } else if (req.language_code) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
      `;
    } else if (req.difficulty_level) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND difficulty_level = ${req.difficulty_level}
      `;
    } else {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM vocabulary_item
        WHERE deleted_at IS NULL
      `;
    }

    return {
      items,
      total: totalRow?.count || 0,
    };
  }
);

export const getVocabularyItem = api(
  { method: "GET", path: "/vocabulary/:id", auth: true },
  async (req: { id: string }): Promise<VocabularyItem> => {
    const userID = requireUserID();

    const item = await vocabularyDB.queryRow<VocabularyItem>`
      SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
      FROM vocabulary_item
      WHERE id = ${req.id} AND deleted_at IS NULL
    `;

    if (!item) {
      throw APIError.notFound("Vocabulary item not found");
    }

    return item;
  }
);

export const searchVocabulary = api(
  { method: "GET", path: "/vocabulary/search", auth: true },
  async (
    req: { query: string; language_code?: string; limit?: number }
  ): Promise<{ items: VocabularyItem[] }> => {
    const userID = requireUserID();

    const limit = req.limit || 20;

    const items: VocabularyItem[] = [];
    let rows: AsyncIterable<VocabularyItem>;

    if (req.language_code) {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND to_tsvector('english', word) @@ plainto_tsquery('english', ${req.query})
          AND language_code = ${req.language_code}
        ORDER BY ts_rank(to_tsvector('english', word), plainto_tsquery('english', ${req.query})) DESC
        LIMIT ${limit}
      `;
    } else {
      rows = vocabularyDB.query<VocabularyItem>`
        SELECT id, language_code, difficulty_level, word, meaning, example_sentence, audio_url, created_at
        FROM vocabulary_item
        WHERE deleted_at IS NULL
          AND to_tsvector('english', word) @@ plainto_tsquery('english', ${req.query})
        ORDER BY ts_rank(to_tsvector('english', word), plainto_tsquery('english', ${req.query})) DESC
        LIMIT ${limit}
      `;
    }

    for await (const item of rows) {
      items.push(item);
    }

    return { items };
  }
);

export const getProgress = api(
  { method: "GET", path: "/progress", auth: true },
  async (
    req: { vocabulary_id?: string }
  ): Promise<{ progress: UserVocabularyProgress[] }> => {
    const userID = requireUserID();

    const progress: UserVocabularyProgress[] = [];
    let rows: AsyncIterable<UserVocabularyProgress>;

    if (req.vocabulary_id) {
      rows = vocabularyDB.query<UserVocabularyProgress>`
        SELECT user_id, vocabulary_id, mastery_level, last_practiced_at, created_at, updated_at
        FROM user_vocabulary_progress
        WHERE user_id = ${userID} AND vocabulary_id = ${req.vocabulary_id}
        ORDER BY updated_at DESC
      `;
    } else {
      rows = vocabularyDB.query<UserVocabularyProgress>`
        SELECT user_id, vocabulary_id, mastery_level, last_practiced_at, created_at, updated_at
        FROM user_vocabulary_progress
        WHERE user_id = ${userID}
        ORDER BY updated_at DESC
      `;
    }

    for await (const prog of rows) {
      progress.push(prog);
    }

    return { progress };
  }
);

export const updateProgress = api(
  { method: "PUT", path: "/progress/:vocabulary_id", auth: true },
  async (
    req: { vocabulary_id: string; mastery_level: number }
  ): Promise<UserVocabularyProgress> => {
    const userID = requireUserID();

    if (req.mastery_level < 0 || req.mastery_level > 100) {
      throw APIError.invalidArgument("Mastery level must be between 0 and 100");
    }

    const progress = await vocabularyDB.queryRow<UserVocabularyProgress>`
      INSERT INTO user_vocabulary_progress (user_id, vocabulary_id, mastery_level, last_practiced_at)
      VALUES (${userID}, ${req.vocabulary_id}, ${req.mastery_level}, NOW())
      ON CONFLICT (user_id, vocabulary_id)
      DO UPDATE SET
        mastery_level = EXCLUDED.mastery_level,
        last_practiced_at = NOW(),
        updated_at = NOW()
      RETURNING user_id, vocabulary_id, mastery_level, last_practiced_at, created_at, updated_at
    `;

    if (!progress) {
      throw APIError.internal("Failed to update progress");
    }

    return progress;
  }
);

export const getReviewItems = api(
  { method: "GET", path: "/progress/review", auth: true },
  async (req: {}): Promise<{ items: VocabularyItem[] }> => {
    const userID = requireUserID();

    const items: VocabularyItem[] = [];
    const rows = await vocabularyDB.query<VocabularyItem>`
      SELECT v.id, v.language_code, v.difficulty_level, v.word, v.meaning, v.example_sentence, v.audio_url, v.created_at
      FROM vocabulary_item v
      LEFT JOIN user_vocabulary_progress p ON v.id = p.vocabulary_id AND p.user_id = ${userID}
      WHERE v.deleted_at IS NULL
        AND (p.mastery_level IS NULL OR p.mastery_level < 80 OR p.last_practiced_at IS NULL OR p.last_practiced_at < NOW() - INTERVAL '7 days')
      ORDER BY COALESCE(p.last_practiced_at, '1970-01-01'::TIMESTAMPTZ) ASC
      LIMIT 20
    `;

    for await (const item of rows) {
      items.push(item);
    }

    return { items };
  }
);

export const createPracticeSession = api(
  { method: "POST", path: "/practice/sessions", auth: true },
  async (
    req: { type: PracticeType; language_code: string }
  ): Promise<PracticeSession> => {
    const userID = requireUserID();

    const session = await vocabularyDB.queryRow<PracticeSession>`
      INSERT INTO practice_session (user_id, type, language_code)
      VALUES (${userID}, ${req.type}, ${req.language_code})
      RETURNING id, user_id, type, language_code, created_at
    `;

    if (!session) {
      throw APIError.internal("Failed to create practice session");
    }

    return session;
  }
);

export const createRecording = api(
  { method: "POST", path: "/practice/sessions/:id/recordings", auth: true },
  async (
    req: { id: string; duration_seconds?: number }
  ): Promise<{ recording_id: string; upload_url: string }> => {
    const userID = requireUserID();

    const session = await vocabularyDB.queryRow<{ id: string; user_id: string }>`
      SELECT id, user_id FROM practice_session WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Practice session not found");
    }

    const recordingId = crypto.randomUUID();
    const s3Key = generateS3Key(userID, req.id, recordingId);

    const recording = await vocabularyDB.queryRow<{ id: string }>`
      INSERT INTO practice_recording (session_id, s3_key, duration_seconds)
      VALUES (${req.id}, ${s3Key}, ${req.duration_seconds || null})
      RETURNING id
    `;

    if (!recording) {
      throw APIError.internal("Failed to create recording");
    }

    const uploadUrl = await generateUploadSignedUrl(s3Key);

    return {
      recording_id: recording.id,
      upload_url: uploadUrl,
    };
  }
);

export const listRecordings = api(
  { method: "GET", path: "/practice/sessions/:id/recordings", auth: true },
  async (
    req: { id: string }
  ): Promise<{ recordings: PracticeRecording[] }> => {
    const userID = requireUserID();

    const session = await vocabularyDB.queryRow<{ id: string }>`
      SELECT id FROM practice_session WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Practice session not found");
    }

    const recordings: PracticeRecording[] = [];
    const rows = await vocabularyDB.query<PracticeRecording>`
      SELECT id, session_id, s3_key, duration_seconds, pronunciation_score, ai_feedback, created_at
      FROM practice_recording
      WHERE session_id = ${req.id}
      ORDER BY created_at DESC
    `;

    for await (const rec of rows) {
      recordings.push(rec);
    }

    return { recordings };
  }
);

export const getRecording = api(
  { method: "GET", path: "/practice/recordings/:id", auth: true },
  async (
    req: { id: string }
  ): Promise<PracticeRecording & { download_url: string }> => {
    const userID = requireUserID();

    const recording = await vocabularyDB.queryRow<PracticeRecording>`
      SELECT pr.id, pr.session_id, pr.s3_key, pr.duration_seconds, pr.pronunciation_score, pr.ai_feedback, pr.created_at
      FROM practice_recording pr
      JOIN practice_session ps ON pr.session_id = ps.id
      WHERE pr.id = ${req.id} AND ps.user_id = ${userID}
    `;

    if (!recording) {
      throw APIError.notFound("Recording not found");
    }

    const downloadUrl = await generateDownloadSignedUrl(recording.s3_key);

    return {
      ...recording,
      download_url: downloadUrl,
    };
  }
);

export const listQuizzes = api(
  { method: "GET", path: "/quizzes", auth: true },
  async (
    req: {
      language_code?: string;
      difficulty_level?: DifficultyLevel;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ quizzes: Quiz[]; total: number }> => {
    const userID = requireUserID();

    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const quizzes: Quiz[] = [];
    let rows: AsyncIterable<Quiz>;

    if (req.language_code && req.difficulty_level) {
      rows = vocabularyDB.query<Quiz>`
        SELECT id, language_code, difficulty_level, created_at
        FROM quiz
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
          AND difficulty_level = ${req.difficulty_level}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (req.language_code) {
      rows = vocabularyDB.query<Quiz>`
        SELECT id, language_code, difficulty_level, created_at
        FROM quiz
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (req.difficulty_level) {
      rows = vocabularyDB.query<Quiz>`
        SELECT id, language_code, difficulty_level, created_at
        FROM quiz
        WHERE deleted_at IS NULL
          AND difficulty_level = ${req.difficulty_level}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = vocabularyDB.query<Quiz>`
        SELECT id, language_code, difficulty_level, created_at
        FROM quiz
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    for await (const quiz of rows) {
      quizzes.push(quiz);
    }

    let totalRow: { count: number } | null;

    if (req.language_code && req.difficulty_level) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM quiz
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
          AND difficulty_level = ${req.difficulty_level}
      `;
    } else if (req.language_code) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM quiz
        WHERE deleted_at IS NULL
          AND language_code = ${req.language_code}
      `;
    } else if (req.difficulty_level) {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM quiz
        WHERE deleted_at IS NULL
          AND difficulty_level = ${req.difficulty_level}
      `;
    } else {
      totalRow = await vocabularyDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM quiz
        WHERE deleted_at IS NULL
      `;
    }

    return {
      quizzes,
      total: totalRow?.count || 0,
    };
  }
);

export const getQuiz = api(
  { method: "GET", path: "/quizzes/:id", auth: true },
  async (
    req: { id: string }
  ): Promise<Quiz & { questions: QuizQuestion[] }> => {
    const userID = requireUserID();

    const quiz = await vocabularyDB.queryRow<Quiz>`
      SELECT id, language_code, difficulty_level, created_at
      FROM quiz
      WHERE id = ${req.id} AND deleted_at IS NULL
    `;

    if (!quiz) {
      throw APIError.notFound("Quiz not found");
    }

    const questions: QuizQuestion[] = [];
    const questionRows = await vocabularyDB.query<QuizQuestion>`
      SELECT id, quiz_id, question_text, options, correct_answer_index, created_at
      FROM quiz_question
      WHERE quiz_id = ${req.id}
      ORDER BY created_at ASC
    `;

    for await (const q of questionRows) {
      questions.push({
        ...q,
        options: q.options as any,
      });
    }

    return {
      ...quiz,
      questions,
    };
  }
);

export const submitQuizAttempt = api(
  { method: "POST", path: "/quizzes/:id/attempts", auth: true },
  async (
    req: { id: string; answers: number[] }
  ): Promise<QuizAttempt> => {
    const userID = requireUserID();

    const quiz = await vocabularyDB.queryRow<{ id: string }>`
      SELECT id FROM quiz WHERE id = ${req.id} AND deleted_at IS NULL
    `;

    if (!quiz) {
      throw APIError.notFound("Quiz not found");
    }

    const questions: QuizQuestion[] = [];
    const questionRows = await vocabularyDB.query<QuizQuestion>`
      SELECT id, quiz_id, question_text, options, correct_answer_index, created_at
      FROM quiz_question
      WHERE quiz_id = ${req.id}
      ORDER BY created_at ASC
    `;

    for await (const q of questionRows) {
      questions.push({
        ...q,
        options: q.options as any,
      });
    }

    if (questions.length !== req.answers.length) {
      throw APIError.invalidArgument("Number of answers does not match number of questions");
    }

    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].correct_answer_index === req.answers[i]) {
        correctCount++;
      }
    }

    const score = (correctCount / questions.length) * 100;

    const attempt = await vocabularyDB.queryRow<QuizAttempt>`
      INSERT INTO quiz_attempt (user_id, quiz_id, score)
      VALUES (${userID}, ${req.id}, ${score})
      RETURNING id, user_id, quiz_id, score, completed_at
    `;

    if (!attempt) {
      throw APIError.internal("Failed to create quiz attempt");
    }

    return attempt;
  }
);

export const getQuizAttempts = api(
  { method: "GET", path: "/quizzes/attempts", auth: true },
  async (
    req: { quiz_id?: string; limit?: number }
  ): Promise<{ attempts: QuizAttempt[] }> => {
    const userID = requireUserID();

    const limit = req.limit || 20;

    const attempts: QuizAttempt[] = [];
    let query = `
      SELECT id, user_id, quiz_id, score, completed_at
      FROM quiz_attempt
      WHERE user_id = $1
    `;
    const params: any[] = [userID];

    if (req.quiz_id) {
      query += ` AND quiz_id = $2`;
      params.push(req.quiz_id);
    }

    query += ` ORDER BY completed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const rows = await vocabularyDB.query<QuizAttempt>(query, params);

    for await (const attempt of rows) {
      attempts.push(attempt);
    }

    return { attempts };
  }
);

export const addFavorite = api(
  { method: "POST", path: "/favorites", auth: true },
  async (
    req: { item_type: FavoriteType; item_id: string }
  ): Promise<FavoriteItem> => {
    const userID = requireUserID();

    const favorite = await vocabularyDB.queryRow<FavoriteItem>`
      INSERT INTO favorite_item (user_id, item_type, item_id)
      VALUES (${userID}, ${req.item_type}, ${req.item_id})
      ON CONFLICT (user_id, item_type, item_id) DO NOTHING
      RETURNING id, user_id, item_type, item_id, created_at
    `;

    if (!favorite) {
      const existing = await vocabularyDB.queryRow<FavoriteItem>`
        SELECT id, user_id, item_type, item_id, created_at
        FROM favorite_item
        WHERE user_id = ${userID} AND item_type = ${req.item_type} AND item_id = ${req.item_id}
      `;
      if (existing) {
        return existing;
      }
      throw APIError.internal("Failed to add favorite");
    }

    return favorite;
  }
);

const FAVORITE_TYPES: FavoriteType[] = ["vocabulary", "quiz"];
function parseFavoriteType(value: string): FavoriteType {
  if (FAVORITE_TYPES.includes(value as FavoriteType)) return value as FavoriteType;
  throw APIError.invalidArgument(`item_type must be one of: ${FAVORITE_TYPES.join(", ")}`);
}

export const removeFavorite = api(
  { method: "DELETE", path: "/favorites/:item_type/:item_id", auth: true },
  async (req: { item_type: string; item_id: string }): Promise<void> => {
    const userID = requireUserID();
    const item_type = parseFavoriteType(req.item_type);

    await vocabularyDB.exec`
      DELETE FROM favorite_item
      WHERE user_id = ${userID} AND item_type = ${item_type} AND item_id = ${req.item_id}
    `;
  }
);

export const listFavorites = api(
  { method: "GET", path: "/favorites", auth: true },
  async (
    req: { item_type?: FavoriteType; limit?: number }
  ): Promise<{ favorites: FavoriteItem[] }> => {
    const userID = requireUserID();

    const limit = req.limit || 20;

    const favorites: FavoriteItem[] = [];
    let rows: AsyncIterable<FavoriteItem>;

    if (req.item_type) {
      rows = vocabularyDB.query<FavoriteItem>`
        SELECT id, user_id, item_type, item_id, created_at
        FROM favorite_item
        WHERE user_id = ${userID} AND item_type = ${req.item_type}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = vocabularyDB.query<FavoriteItem>`
        SELECT id, user_id, item_type, item_id, created_at
        FROM favorite_item
        WHERE user_id = ${userID}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    for await (const fav of rows) {
      favorites.push(fav);
    }

    return { favorites };
  }
);
