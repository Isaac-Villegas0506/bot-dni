-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.personas (
  dni character varying NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT personas_pkey PRIMARY KEY (dni)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  password_hash character varying,
  full_name character varying,
  google_id character varying UNIQUE,
  avatar_url text,
  role character varying DEFAULT 'user'::character varying,
  status character varying DEFAULT 'active'::character varying,
  is_premium boolean DEFAULT false,
  credits integer DEFAULT 0,
  verification_code character varying,
  verification_expires timestamp with time zone,
  is_verified boolean DEFAULT false,
  last_daily_credit timestamp with time zone,
  last_premium_search timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_login timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_ip character varying,
  unlimited_until timestamp without time zone,
  unlimited_started_at timestamp without time zone,
  referral_code character varying UNIQUE,
  referred_by integer,
  has_bought_promo boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id)
);
CREATE TABLE public.search_history (
  id integer NOT NULL DEFAULT nextval('search_history_id_seq'::regclass),
  user_id integer,
  search_term character varying NOT NULL,
  search_type character varying NOT NULL,
  ip_address character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  device character varying,
  browser character varying,
  os character varying,
  user_agent text,
  CONSTRAINT search_history_pkey PRIMARY KEY (id),
  CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.banned_ips (
  id integer NOT NULL DEFAULT nextval('banned_ips_id_seq'::regclass),
  ip_address character varying NOT NULL UNIQUE,
  reason text,
  banned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT banned_ips_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bots (
  id integer NOT NULL DEFAULT nextval('bots_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  status character varying DEFAULT 'active'::character varying,
  bot_type character varying DEFAULT 'dni'::character varying,
  is_available boolean DEFAULT true,
  last_checked timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bots_pkey PRIMARY KEY (id)
);
CREATE TABLE public.announcements (
  id integer NOT NULL DEFAULT nextval('announcements_id_seq'::regclass),
  title character varying NOT NULL,
  message text NOT NULL,
  start_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  end_date timestamp with time zone,
  is_active boolean DEFAULT true,
  frequency_minutes integer DEFAULT 60,
  created_by integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.credit_costs (
  option_id character varying NOT NULL,
  cost integer NOT NULL DEFAULT 1,
  label character varying NOT NULL,
  CONSTRAINT credit_costs_pkey PRIMARY KEY (option_id)
);
CREATE TABLE public.credit_log (
  id integer NOT NULL DEFAULT nextval('credit_log_id_seq'::regclass),
  user_id integer NOT NULL,
  amount integer NOT NULL,
  reason character varying,
  admin_email character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT credit_log_pkey PRIMARY KEY (id),
  CONSTRAINT credit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.credit_purchases (
  id integer NOT NULL DEFAULT nextval('credit_purchases_id_seq'::regclass),
  user_id integer NOT NULL,
  plan_key character varying NOT NULL,
  plan_label character varying NOT NULL,
  amount_soles numeric NOT NULL,
  credits_to_assign integer NOT NULL DEFAULT 0,
  is_premium_plan boolean DEFAULT false,
  payment_method character varying,
  receipt_image_url character varying,
  status character varying DEFAULT 'pending'::character varying,
  rejection_reason text,
  reviewed_by integer,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  unlimited_days integer,
  unlimited_expires_at timestamp without time zone,
  CONSTRAINT credit_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT credit_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT credit_purchases_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.credit_packages (
  id integer NOT NULL DEFAULT nextval('credit_packages_id_seq'::regclass),
  plan_key character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  price_soles numeric NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  unlimited_days integer,
  is_premium boolean DEFAULT false,
  is_active boolean DEFAULT true,
  CONSTRAINT credit_packages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id integer NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.promo_requests (
  id integer NOT NULL DEFAULT nextval('promo_requests_id_seq'::regclass),
  user_id integer NOT NULL,
  tiktok_username character varying NOT NULL,
  video_url text NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  reviewed_by integer,
  reviewed_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  user_notified boolean DEFAULT false,
  CONSTRAINT promo_requests_pkey PRIMARY KEY (id),
  CONSTRAINT promo_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT promo_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.system_settings (
  setting_key character varying NOT NULL,
  setting_value boolean DEFAULT true,
  label character varying NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_settings_pkey PRIMARY KEY (setting_key)
);
CREATE TABLE public.banners (
  id integer NOT NULL DEFAULT nextval('banners_id_seq'::regclass),
  title character varying,
  image_url_desktop character varying NOT NULL,
  image_url_mobile character varying NOT NULL,
  target_url character varying,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT banners_pkey PRIMARY KEY (id)
);