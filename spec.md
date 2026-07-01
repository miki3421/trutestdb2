# TruTestDB - Specifiche di Progetto

## Obbiettivo del Progetto

Creare un'applicazione web per la gestione contatti e ordini con autenticazione utenti.

## Funzionalità Richieste

### 1. Autenticazione Utenti
- **Login**: Accesso per utenti registrati
- **Registrazione**: Creazione nuovo account utente
- Gestione sessione utente

### 2. Gestione Contatti (CRUD)
- **Create**: Aggiungere nuovi contatti
- **Read**: Visualizzare lista contatti e dettagli singolo contatto
- **Update**: Modificare contatti esistenti
- **Delete**: Eliminare contatti

### 3. Gestione Ordini (CRUD)
- **Create**: Creare nuovi ordini
- **Read**: Visualizzare lista ordini e dettagli singolo ordine
- **Update**: Modificare ordini esistenti
- **Delete**: Eliminare ordini

### 4. Persistenza Dati
- Tutti i dati (Contatti, Utenti, Ordini) devono essere salvati nel database PostgreSQL

## Stack Tecnologico

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Routing**: React Router v6 (HashRouter)
- **Server State**: React Query
- **Backend**: OpenServerless actions (Python)
- **Database**: PostgreSQL

## Struttura Dati

### Utenti
- id (SERIAL PRIMARY KEY)
- email (UNIQUE)
- password (hashato)
- nome
- creato_at

### Contatti
- id (SERIAL PRIMARY KEY)
- user_id (FOREIGN KEY → utenti.id)
- nome
- email
- telefono
- nota
- creato_at

### Ordini
- id (SERIAL PRIMARY KEY)
- user_id (FOREIGN KEY → utenti.id)
- contatto_id (FOREIGN KEY → contatti.id, nullable)
- data_ordine
- stato (pending/shipped/delivered/cancelled)
- totale
- creato_at

## API Endpoints

### Autenticazione
- `POST /api/my/v1/register` - Registrazione utente
- `POST /api/my/v1/login` - Login utente
- `GET /api/my/v1/me` - Informazioni utente corrente

### Contatti
- `GET /api/my/v1/contacts` - Lista contatti
- `POST /api/my/v1/contacts` - Crea contatto
- `PUT /api/my/v1/contacts/{id}` - Aggiorna contatto
- `DELETE /api/my/v1/contacts/{id}` - Elimina contatto

### Ordini
- `GET /api/my/v1/orders` - Lista ordini
- `POST /api/my/v1/orders` - Crea ordine
- `PUT /api/my/v1/orders/{id}` - Aggiorna ordine
- `DELETE /api/my/v1/orders/{id}` - Elimina ordine

## Note Implementative

- Tutte le operazioni CRUD devono essere filtrate per user_id (utente autenticato)
- Password devono essere hashate (bcrypt)
- Sessioni gestite tramite token JWT o session ID in Redis
- Validazione input lato client e server
