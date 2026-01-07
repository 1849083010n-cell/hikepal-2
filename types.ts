export enum Tab {
  PLANNING = 'PLANNING',
  COMPANION = 'COMPANION',
  HOME = 'HOME'
}

export interface Route {
  id: string;
  name: string;
  region: string;
  distance: string;
  duration: string;
  difficulty: number; // 1-5
  description: string;
  startPoint: string;
  endPoint: string;
  elevationGain: number;
  isUserPublished?: boolean; // To highlight user uploads
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  type: 'photo' | 'marker';
  note?: string;
  imageUrl?: string;
}

export interface Track {
  id: string;
  name: string;
  date: Date;
  duration: string;
  distance: string;
  coordinates: [number, number][];
  waypoints: Waypoint[];
}

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'teammate';
  senderName?: string;
  text: string;
  timestamp: Date;
}

export interface Teammate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'active' | 'inactive';
  avatar: string;
}

export interface UserStats {
  totalDistanceKm: number;
  hikesCompleted: number;
  elevationGainedM: number;
  status: string;
}