export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            rooms: {
                Row: {
                    room_id: string
                    room_name: string
                    password_hash: string | null
                    host_user_id: string
                    current_video: string | null
                    current_order: number
                    is_playing: boolean
                    current_position: number
                    override_video_id: string | null
                    expires_at: string
                    active: boolean
                    created_at: string
                }
                Insert: {
                    room_id: string
                    room_name: string
                    password_hash?: string | null
                    host_user_id: string
                    current_video?: string | null
                    current_order?: number
                    is_playing?: boolean
                    current_position?: number
                    override_video_id?: string | null
                    expires_at: string
                    active?: boolean
                    created_at?: string
                }
                Update: {
                    room_id?: string
                    room_name?: string
                    password_hash?: string | null
                    host_user_id?: string
                    current_video?: string | null
                    current_order?: number
                    is_playing?: boolean
                    current_position?: number
                    override_video_id?: string | null
                    expires_at?: string
                    active?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            queue: {
                Row: {
                    queue_id: string
                    room_id: string
                    youtube_id: string
                    title: string
                    thumbnail: string | null
                    duration: string | null
                    added_by: string
                    order_index: number
                    created_at: string
                }
                Insert: {
                    queue_id?: string
                    room_id: string
                    youtube_id: string
                    title: string
                    thumbnail?: string | null
                    duration?: string | null
                    added_by: string
                    order_index: number
                    created_at?: string
                }
                Update: {
                    queue_id?: string
                    room_id?: string
                    youtube_id?: string
                    title?: string
                    thumbnail?: string | null
                    duration?: string | null
                    added_by?: string
                    order_index?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "queue_room_id_fkey"
                        columns: ["room_id"]
                        referencedRelation: "rooms"
                        referencedColumns: ["room_id"]
                    }
                ]
            }
            votes: {
                Row: {
                    vote_id: string
                    room_id: string
                    youtube_id: string
                    voted_by: string
                    created_at: string
                }
                Insert: {
                    vote_id?: string
                    room_id: string
                    youtube_id: string
                    voted_by: string
                    created_at?: string
                }
                Update: {
                    vote_id?: string
                    room_id?: string
                    youtube_id?: string
                    voted_by?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "votes_room_id_fkey"
                        columns: ["room_id"]
                        referencedRelation: "rooms"
                        referencedColumns: ["room_id"]
                    }
                ]
            }
            room_presence: {
                Row: {
                    room_id: string
                    user_id: string
                    last_seen: string
                }
                Insert: {
                    room_id: string
                    user_id: string
                    last_seen?: string
                }
                Update: {
                    room_id?: string
                    user_id?: string
                    last_seen?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "room_presence_room_id_fkey"
                        columns: ["room_id"]
                        referencedRelation: "rooms"
                        referencedColumns: ["room_id"]
                    }
                ]
            }
            messages: {
                Row: {
                    message_id: string
                    room_id: string
                    user_id: string
                    content: string
                    created_at: string
                }
                Insert: {
                    message_id?: string
                    room_id: string
                    user_id: string
                    content: string
                    created_at?: string
                }
                Update: {
                    message_id?: string
                    room_id?: string
                    user_id?: string
                    content?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "messages_room_id_fkey"
                        columns: ["room_id"]
                        referencedRelation: "rooms"
                        referencedColumns: ["room_id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Helper types for easier usage
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type RoomUpdate = Database['public']['Tables']['rooms']['Update']

export type QueueItem = Database['public']['Tables']['queue']['Row']
export type QueueInsert = Database['public']['Tables']['queue']['Insert']
export type QueueUpdate = Database['public']['Tables']['queue']['Update']

export type Vote = Database['public']['Tables']['votes']['Row']
export type VoteInsert = Database['public']['Tables']['votes']['Insert']

export type RoomPresence = Database['public']['Tables']['room_presence']['Row']
export type RoomPresenceInsert = Database['public']['Tables']['room_presence']['Insert']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
