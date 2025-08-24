-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS room_presence CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS queue CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- Create rooms table
CREATE TABLE rooms (
  room_id TEXT PRIMARY KEY,
  room_name TEXT NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  current_video TEXT,
  current_order INTEGER DEFAULT 0,
  is_playing BOOLEAN DEFAULT FALSE,
  current_position REAL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  override_video_id TEXT,
  host_user_id TEXT NOT NULL
);

-- Create queue table
CREATE TABLE queue (
  queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  duration TEXT,
  added_by TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table for skip voting
CREATE TABLE votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  voted_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, youtube_id, voted_by)
);

-- Create messages table for realtime chat
CREATE TABLE messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_presence table for active users
CREATE TABLE room_presence (
  room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_rooms_active ON rooms(active);
CREATE INDEX idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX idx_queue_room_order ON queue(room_id, order_index);
CREATE INDEX idx_presence_room ON room_presence(room_id);
CREATE INDEX idx_presence_last_seen ON room_presence(last_seen);
CREATE INDEX idx_messages_room_created_at ON messages(room_id, created_at);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're not using auth)
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on queue" ON queue FOR ALL USING (true);
CREATE POLICY "Allow all operations on votes" ON votes FOR ALL USING (true);
CREATE POLICY "Allow all operations on room_presence" ON room_presence FOR ALL USING (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);

-- Insert some sample data for testing (optional)
-- INSERT INTO rooms (room_id, room_name, host_user_id, expires_at) 
-- VALUES ('demo-room', 'Demo Room', 'demo-user', NOW() + INTERVAL '2 hours');
