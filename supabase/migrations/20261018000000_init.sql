-- QuizWave initial schema (mirrors backend/prisma/schema.prisma)
-- Timestamps are epoch-ms BIGINT to match backend domain types.

CREATE TYPE "Role" AS ENUM ('host', 'student');
CREATE TYPE "SessionStatus" AS ENUM ('lobby', 'question_open', 'question_closed', 'ended');

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'host',
  "created_at" BIGINT NOT NULL
);

CREATE TABLE "quizzes" (
  "id" TEXT PRIMARY KEY,
  "host_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "base_points" INTEGER NOT NULL DEFAULT 1000,
  "created_at" BIGINT NOT NULL,
  "updated_at" BIGINT NOT NULL
);
CREATE INDEX "quizzes_host_id_idx" ON "quizzes"("host_id");

CREATE TABLE "questions" (
  "id" TEXT PRIMARY KEY,
  "quiz_id" TEXT NOT NULL REFERENCES "quizzes"("id") ON DELETE CASCADE,
  "order_index" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "image_url" TEXT,
  "video_url" TEXT,
  "audio_url" TEXT,
  "time_limit_sec" INTEGER NOT NULL DEFAULT 20,
  CONSTRAINT "questions_quiz_id_order_index_key" UNIQUE ("quiz_id", "order_index")
);

CREATE TABLE "answer_options" (
  "id" TEXT PRIMARY KEY,
  "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "image_url" TEXT,
  "video_url" TEXT,
  "is_correct" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "answer_options_question_id_idx" ON "answer_options"("question_id");

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY,
  "quiz_id" TEXT NOT NULL REFERENCES "quizzes"("id") ON DELETE CASCADE,
  "host_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL UNIQUE,
  "status" "SessionStatus" NOT NULL DEFAULT 'lobby',
  "current_question_index" INTEGER NOT NULL DEFAULT 0,
  "total_questions" INTEGER NOT NULL,
  "started_at" BIGINT NOT NULL,
  "deadline" BIGINT,
  "time_limit_sec" INTEGER
);
CREATE INDEX "sessions_host_id_idx" ON "sessions"("host_id");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

CREATE TABLE "participants" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "display_name" TEXT NOT NULL,
  "avatar" TEXT NOT NULL DEFAULT '',
  "total_score" INTEGER NOT NULL DEFAULT 0,
  "joined_at" BIGINT NOT NULL,
  "correct_answers_count" INTEGER NOT NULL DEFAULT 0,
  "last_delta" INTEGER NOT NULL DEFAULT 0,
  "last_answer_option_id" TEXT,
  "last_is_correct" BOOLEAN,
  "total_response_time" DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX "participants_session_id_idx" ON "participants"("session_id");

CREATE TABLE "session_responses" (
  "session_id" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "participant_id" TEXT NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
  "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "option_id" TEXT NOT NULL,
  "submitted_at" BIGINT NOT NULL,
  "time_remaining_sec" DOUBLE PRECISION NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "is_correct" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("session_id", "participant_id", "question_id")
);
CREATE INDEX "session_responses_question_id_idx" ON "session_responses"("question_id");
