export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'employee';
  avatar_url?: string;
  face_image_path?: string;
  is_active?: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  type: 'check_in' | 'check_out';
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string;
  face_image_url?: string;
  verified: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: 'izin' | 'sakit';
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface AttendanceStats {
  total_hadir: number;
  total_izin: number;
  total_sakit: number;
  total_alpa: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
