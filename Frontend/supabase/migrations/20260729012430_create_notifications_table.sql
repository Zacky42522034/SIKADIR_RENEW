-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see their own notifications
CREATE POLICY "Users can view their own notifications" 
    ON public.notifications FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
    ON public.notifications FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create trigger function for leave request status changes
CREATE OR REPLACE FUNCTION notify_leave_request_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed from pending to approved
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
            NEW.user_id, 
            'Pengajuan Izin Diterima', 
            'Pengajuan ' || NEW.type || ' Anda untuk tanggal ' || NEW.start_date || ' telah disetujui.'
        );
    -- If status changed from pending to rejected
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
            NEW.user_id, 
            'Pengajuan Izin Ditolak', 
            'Pengajuan ' || NEW.type || ' Anda untuk tanggal ' || NEW.start_date || ' telah ditolak.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_leave_request_update ON public.leave_requests;
CREATE TRIGGER on_leave_request_update
    AFTER UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_leave_request_status();
