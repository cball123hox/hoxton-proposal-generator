-- Promote chris@hoxtonwealth.com to system_admin
UPDATE public.profiles
SET role = 'system_admin',
    full_name = 'Chris Sherrington',
    region = 'int'
WHERE email = 'chris@hoxtonwealth.com';
