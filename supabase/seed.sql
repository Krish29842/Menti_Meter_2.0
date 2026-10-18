-- Demo data for local dev (`supabase db reset` applies migrations then this seed).
-- The demo host's password_hash is a placeholder: register real accounts via
-- POST /api/auth/register (backend bcrypt-hashes passwords) instead of logging in with this row.

INSERT INTO "users" ("id", "email", "name", "password_hash", "role", "created_at")
VALUES (
  'user_demo_host', 'host@demo.local', 'Demo Host',
  '$2a$10$replace_via_register_api_not_this_value000000000000000000000000',
  'host', EXTRACT(EPOCH FROM now()) * 1000
);

INSERT INTO "quizzes" ("id", "host_id", "title", "description", "base_points", "created_at", "updated_at")
VALUES (
  'quiz_demo', 'user_demo_host', 'General Knowledge Demo',
  'A sample quiz created by supabase/seed.sql', 1000,
  EXTRACT(EPOCH FROM now()) * 1000, EXTRACT(EPOCH FROM now()) * 1000
);

INSERT INTO "questions" ("id", "quiz_id", "order_index", "prompt", "time_limit_sec")
VALUES
  ('q_demo_1', 'quiz_demo', 0, 'Which planet is known as the Red Planet?', 20),
  ('q_demo_2', 'quiz_demo', 1, 'What is the chemical symbol for gold?', 15);

INSERT INTO "answer_options" ("id", "question_id", "text", "is_correct")
VALUES
  ('opt_1a', 'q_demo_1', 'Venus', false),
  ('opt_1b', 'q_demo_1', 'Mars', true),
  ('opt_1c', 'q_demo_1', 'Jupiter', false),
  ('opt_1d', 'q_demo_1', 'Saturn', false),
  ('opt_2a', 'q_demo_2', 'Ag', false),
  ('opt_2b', 'q_demo_2', 'Fe', false),
  ('opt_2c', 'q_demo_2', 'Au', true),
  ('opt_2d', 'q_demo_2', 'Go', false);
