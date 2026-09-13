\set ON_ERROR_STOP on
UPDATE app_users SET role = :'role' WHERE email = lower(trim(:'email')) RETURNING email, name, role;
