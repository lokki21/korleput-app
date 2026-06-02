import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ============ ROOMS ============
export type Request = {
  id: string;
  lead: string;
  type: 'solo' | 'couple' | 'family';
  members: string[];
  priv: 'private' | 'share';
  nights: string[];
  created_at?: string;
};

export type Assignment = {
  id?: string;
  night: string;
  room_id: string;
  person_name: string;
};

// ============ FOOD ============
export type Diet = {
  id?: string;
  name: string;
  diet: 'omni' | 'veg' | 'vegan' | 'pesc' | 'other';
  allergies?: string;
  attending: string[];
  notes?: string;
};

export type Dish = {
  id?: string;
  meal: string;
  name: string;
  category: 'main' | 'side' | 'salad' | 'bread' | 'dessert' | 'drink' | 'other';
  covers: string[];
  portion_g: number;
  unit: 'g' | 'piece' | 'ml' | 'L';
  notes?: string;
};

export type BringItem = {
  id?: string;
  meal: string;
  description: string;
  brought_by: string;
  quantity?: string;
};

export type Drink = {
  id?: string;
  name: string;
  qty_target: string;
  notes?: string;
};
