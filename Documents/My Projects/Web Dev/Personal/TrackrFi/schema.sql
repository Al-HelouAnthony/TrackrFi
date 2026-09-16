--
-- PostgreSQL database dump
--

\restrict 5WbRBg8p00ZxITqQ0rcXkWIOTlIhzQFOB9NW3sq4ZhqXWZFN83BSxVcYzcMKdIc

-- Dumped from database version 15.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-08-02 20:07:51

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16460)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3448 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 869 (class 1247 OID 16556)
-- Name: account_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.account_type AS ENUM (
    'Savings',
    'Checking',
    'Credit',
    'Cash',
    'Loan'
);


ALTER TYPE public.account_type OWNER TO postgres;

--
-- TOC entry 887 (class 1247 OID 16712)
-- Name: budget_period; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.budget_period AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE public.budget_period OWNER TO postgres;

--
-- TOC entry 884 (class 1247 OID 16704)
-- Name: category_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.category_type AS ENUM (
    'income',
    'expense'
);


ALTER TYPE public.category_type OWNER TO postgres;

--
-- TOC entry 872 (class 1247 OID 16564)
-- Name: currency; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.currency AS ENUM (
    'USD',
    'CAD'
);


ALTER TYPE public.currency OWNER TO postgres;

--
-- TOC entry 881 (class 1247 OID 16698)
-- Name: sync_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sync_type AS ENUM (
    'synced',
    'not synced'
);


ALTER TYPE public.sync_type OWNER TO postgres;

--
-- TOC entry 875 (class 1247 OID 16577)
-- Name: transaction_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_source AS ENUM (
    'Manual',
    'Bank Sync'
);


ALTER TYPE public.transaction_source OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16541)
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.account_type NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    currency public.currency NOT NULL,
    logo text NOT NULL,
    user_id uuid NOT NULL,
    sync_status public.sync_type,
    plaid_id character varying(255),
    plaid_account_id character varying(255),
    balance numeric(12,2)
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16521)
-- Name: budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    period character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT budgets_period_check CHECK (((period)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])))
);


ALTER TABLE public.budgets OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 16482)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(10) DEFAULT '•'::character varying,
    color character varying(50) DEFAULT '#64748b'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    type public.category_type NOT NULL,
    plaid_primary_code character varying(255)
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16720)
-- Name: plaid_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plaid_items (
    id integer NOT NULL,
    user_id uuid,
    access_token character varying(255) NOT NULL,
    item_id character varying(255) NOT NULL,
    institution_id character varying(255),
    institution_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cursor character varying(255),
    last_synced_at timestamp with time zone DEFAULT now(),
    status character varying(255) DEFAULT 'good'::character varying
);


ALTER TABLE public.plaid_items OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16719)
-- Name: plaid_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.plaid_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plaid_items_id_seq OWNER TO postgres;

--
-- TOC entry 3449 (class 0 OID 0)
-- Dependencies: 220
-- Name: plaid_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plaid_items_id_seq OWNED BY public.plaid_items.id;


--
-- TOC entry 222 (class 1259 OID 16739)
-- Name: subcategories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subcategories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid,
    name character varying(255) NOT NULL,
    plaid_detailed_code character varying(255)
);


ALTER TABLE public.subcategories OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16753)
-- Name: template_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.template_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    plaid_primary_code character varying(255) NOT NULL,
    icon character varying(50),
    color character varying(50)
);


ALTER TABLE public.template_categories OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16763)
-- Name: template_subcategories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.template_subcategories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_category_id uuid,
    name character varying(255) NOT NULL,
    plaid_detailed_code character varying(255) NOT NULL
);


ALTER TABLE public.template_subcategories OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16501)
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    name character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    exclude_from_monthly boolean DEFAULT false,
    account_id uuid NOT NULL,
    source public.transaction_source NOT NULL,
    plaid_transaction_id character varying(255),
    pending boolean DEFAULT false,
    subcategory_id uuid
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- TOC entry 215 (class 1259 OID 16471)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_name character varying(255) NOT NULL,
    monthly_target numeric(12,2) NOT NULL,
    phone_number character varying(15),
    default_currency public.currency NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 3247 (class 2604 OID 16723)
-- Name: plaid_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plaid_items ALTER COLUMN id SET DEFAULT nextval('public.plaid_items_id_seq'::regclass);


--
-- TOC entry 3272 (class 2606 OID 16547)
-- Name: accounts account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- TOC entry 3274 (class 2606 OID 16794)
-- Name: accounts accounts_plaid_account_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plaid_account_id_key UNIQUE (plaid_account_id);


--
-- TOC entry 3268 (class 2606 OID 16528)
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- TOC entry 3270 (class 2606 OID 16718)
-- Name: budgets budgets_user_id_category_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_category_id_key UNIQUE (user_id, category_id);


--
-- TOC entry 3259 (class 2606 OID 16490)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3261 (class 2606 OID 16492)
-- Name: categories categories_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);


--
-- TOC entry 3276 (class 2606 OID 16730)
-- Name: plaid_items plaid_items_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plaid_items
    ADD CONSTRAINT plaid_items_item_id_key UNIQUE (item_id);


--
-- TOC entry 3278 (class 2606 OID 16728)
-- Name: plaid_items plaid_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plaid_items
    ADD CONSTRAINT plaid_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3280 (class 2606 OID 16747)
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- TOC entry 3282 (class 2606 OID 16760)
-- Name: template_categories template_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_categories
    ADD CONSTRAINT template_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3284 (class 2606 OID 16762)
-- Name: template_categories template_categories_plaid_primary_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_categories
    ADD CONSTRAINT template_categories_plaid_primary_code_key UNIQUE (plaid_primary_code);


--
-- TOC entry 3286 (class 2606 OID 16770)
-- Name: template_subcategories template_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_subcategories
    ADD CONSTRAINT template_subcategories_pkey PRIMARY KEY (id);


--
-- TOC entry 3288 (class 2606 OID 16772)
-- Name: template_subcategories template_subcategories_plaid_detailed_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_subcategories
    ADD CONSTRAINT template_subcategories_plaid_detailed_code_key UNIQUE (plaid_detailed_code);


--
-- TOC entry 3264 (class 2606 OID 16509)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3266 (class 2606 OID 16780)
-- Name: transactions transactions_plaid_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_plaid_transaction_id_key UNIQUE (plaid_transaction_id);


--
-- TOC entry 3255 (class 2606 OID 16481)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3257 (class 2606 OID 16479)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3262 (class 1259 OID 16574)
-- Name: fki_transactions_account_id_fkey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_transactions_account_id_fkey ON public.transactions USING btree (account_id);


--
-- TOC entry 3296 (class 2606 OID 16788)
-- Name: accounts accounts_plaid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plaid_id_fkey FOREIGN KEY (plaid_id) REFERENCES public.plaid_items(item_id);


--
-- TOC entry 3297 (class 2606 OID 16692)
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3294 (class 2606 OID 16536)
-- Name: budgets budgets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- TOC entry 3295 (class 2606 OID 16531)
-- Name: budgets budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3289 (class 2606 OID 16493)
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3298 (class 2606 OID 16731)
-- Name: plaid_items plaid_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plaid_items
    ADD CONSTRAINT plaid_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3299 (class 2606 OID 16748)
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- TOC entry 3300 (class 2606 OID 16773)
-- Name: template_subcategories template_subcategories_template_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.template_subcategories
    ADD CONSTRAINT template_subcategories_template_category_id_fkey FOREIGN KEY (template_category_id) REFERENCES public.template_categories(id) ON DELETE CASCADE;


--
-- TOC entry 3290 (class 2606 OID 16569)
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- TOC entry 3291 (class 2606 OID 16515)
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- TOC entry 3292 (class 2606 OID 16781)
-- Name: transactions transactions_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id);


--
-- TOC entry 3293 (class 2606 OID 16510)
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-08-02 20:07:51

--
-- PostgreSQL database dump complete
--

\unrestrict 5WbRBg8p00ZxITqQ0rcXkWIOTlIhzQFOB9NW3sq4ZhqXWZFN83BSxVcYzcMKdIc


 C R E A T E   T A B L E   p u b l i c . r e g i s t r a t i o n _ o t p s   ( 
         e m a i l   c h a r a c t e r   v a r y i n g ( 2 5 5 )   P R I M A R Y   K E Y , 
         o t p _ c o d e   c h a r a c t e r   v a r y i n g ( 6 )   N O T   N U L L , 
         e x p i r e s _ a t   t i m e s t a m p   w i t h   t i m e   z o n e   N O T   N U L L , 
         v e r i f i e d _ a t   t i m e s t a m p   w i t h   t i m e   z o n e 
 ) ;  
 
-- SimpleFin Integrations
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS simplefin_access_url TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS simplefin_account_id TEXT UNIQUE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS simplefin_transaction_id TEXT UNIQUE;

