export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
 public: {
  Tables: {
   profiles: {
    Row: {
     id: string;
     display_name: string | null;
     created_at: string;
    };
    Insert: {
     id: string;
     display_name?: string | null;
     created_at?: string;
    };
    Update: {
     id?: string;
     display_name?: string | null;
     created_at?: string;
    };
    Relationships: [];
   };
   boards: {
    Row: {
     id: string;
     owner_id: string;
     name: string;
     description: string | null;
     created_at: string;
     updated_at: string;
    };
    Insert: {
     id?: string;
     owner_id: string;
     name: string;
     description?: string | null;
     created_at?: string;
     updated_at?: string;
    };
    Update: {
     id?: string;
     owner_id?: string;
     name?: string;
     description?: string | null;
     created_at?: string;
     updated_at?: string;
    };
    Relationships: [
     {
      foreignKeyName: "boards_owner_id_fkey";
      columns: ["owner_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
     },
    ];
   };
   tasks: {
    Row: {
     id: string;
     board_id: string;
     title: string;
     description: string | null;
     status: "todo" | "in_progress" | "done";
     position: number;
     created_at: string;
     updated_at: string;
    };
    Insert: {
     id?: string;
     board_id: string;
     title: string;
     description?: string | null;
     status?: "todo" | "in_progress" | "done";
     position?: number;
     created_at?: string;
     updated_at?: string;
    };
    Update: {
     id?: string;
     board_id?: string;
     title?: string;
     description?: string | null;
     status?: "todo" | "in_progress" | "done";
     position?: number;
     created_at?: string;
     updated_at?: string;
    };
    Relationships: [
     {
      foreignKeyName: "tasks_board_id_fkey";
      columns: ["board_id"];
      isOneToOne: false;
      referencedRelation: "boards";
      referencedColumns: ["id"];
     },
    ];
   };
  };
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
 };
};
