# TruTestDB - Specifiche di Progetto

## Obbiettivo del Progetto

Creare un'applicazione web per la gestione contatti e ordini con autenticazione utenti.

**STATO: COMPLETATO** ✅

## Funzionalità Implementate

### 1. Autenticazione Utenti ✅
- **Login**: Accesso per utenti registrati con token sessione
- **Registrazione**: Creazione nuovo account utente con password hashata (bcrypt)
- **Gestione sessione**: Token Bearer validi 24 ore, salvati in DB

### 2. Gestione Contatti (CRUD) ✅
- **Create**: Aggiungere nuovi contatti
- **Read**: Visualizzare lista contatti e dettagli singolo contatto
- **Update**: Modificare contatti esistenti
- **Delete**: Eliminare contatti

### 3. Gestione Ordini (CRUD) ✅
- **Create**: Creare nuovi ordini
- **Read**: Visualizzare lista ordini e dettagli singolo ordine
- **Update**: Modificare ordini esistenti
- **Delete**: Eliminare ordini

### 4. Persistenza Dati ✅
- Tutti i dati salvati in PostgreSQL
- Tabelle: users, contacts, orders, sessions
- Relazioni foreign key con cascade/delete

## Stack Tecnologico

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Routing**: React Router v6 (HashRouter)
- **Server State**: React Query
- **Backend**: OpenServerless actions (Python)
- **Database**: PostgreSQL
- **Auth**: Token Bearer con sessioni in DB

## Struttura Dati

### Utenti
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
password VARCHAR(255) NOT NULL  -- hashato con bcrypt
nome VARCHAR(100) NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Contatti
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
nome VARCHAR(100) NOT NULL
email VARCHAR(255)
telefono VARCHAR(20)
nota TEXT
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Ordini
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
contatto_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL
data_ordine DATE NOT NULL
stato VARCHAR(20) DEFAULT 'pending' -- pending/shipped/delivered/cancelled
totale DECIMAL(10,2)
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Sessioni (Auth)
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
token VARCHAR(255) UNIQUE NOT NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
expires_at TIMESTAMP -- null = nessuna scadenza
```

## API Endpoints

### Autenticazione
- `POST /api/my/v1/register` - Registrazione utente `{email, password, nome}`
- `POST /api/my/v1/login` - Login utente `{email, password}` → `{token, user}`
- `GET /api/my/v1/me` - Informazioni utente (header: `Authorization: Bearer <token>`)

### Contatti (richiede autenticazione)
- `GET /api/my/v1/contacts` - Lista contatti utente
- `POST /api/my/v1/contacts` - Crea contatto `{nome, email?, telefono?, nota?}`
- `PUT /api/my/v1/contacts/{id}` - Aggiorna contatto
- `DELETE /api/my/v1/contacts/{id}` - Elimina contatto

### Ordini (richiede autenticazione)
- `GET /api/my/v1/orders` - Lista ordini utente
- `POST /api/my/v1/orders` - Crea ordine `{data_ordine, stato?, totale?, contatto_id?}`
- `PUT /api/my/v1/orders/{id}` - Aggiorna ordine
- `DELETE /api/my/v1/orders/{id}` - Elimina ordine

## Route Frontend

- `/` - Redirect automatico (login se non auth, contacts se auth)
- `/login` - Pagina login
- `/register` - Pagina registrazione
- `/contacts` - Gestione contatti (protetta)
- `/orders` - Gestione ordini (protetta)

## Sicurezza

1. **Password**: Hashate con bcrypt prima del salvataggio
2. **Auth**: Token Bearer validi 24 ore, verificati su ogni richiesta protetta
3. **Ownership**: Tutte le operazioni CRUD verificano che il record appartenga all'utente autenticato
4. **Sessioni**: Salvate in DB con scadenza automatica

## File Principali

### Backend
- `packages/setup/database/database.py` - Inizializzazione schema DB
- `packages/v1/register/register.py` - Registrazione
- `packages/v1/login/login.py` - Login e sessioni
- `packages/v1/me/me.py` - Validazione token
- `packages/v1/contacts/contacts.py` - CRUD contatti
- `packages/v1/orders/orders.py` - CRUD ordini

### Frontend
- `src/pages/LoginPage.tsx` - Form login
- `src/pages/RegisterPage.tsx` - Form registrazione
- `src/pages/ContactsPage.tsx` - Lista e gestione contatti
- `src/pages/OrdersPage.tsx` - Lista e gestione ordini
- `src/components/Navbar.tsx` - Navigazione globale
- `src/components/ContactForm.tsx` - Form aggiunta/modifica contatto
- `src/components/OrderForm.tsx` - Form aggiunta/modifica ordine

## Comandi

```bash
# Inizializza database (tabella sessions inclusa)
timeout 120 ops ide setup

# Deploy actions
timeout 120 ops ide deploy

# Validazione
timeout 60 check_openserverless_actions.sh .
```
