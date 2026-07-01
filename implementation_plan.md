# TruTestDB - Piano di Implementazione

## Stato Attuale
- Progetto React Vite base con routing HashRouter
- Nessuna funzionalità implementata
- Nessun database configurato

## Fasi di Implementazione

### Fase 1: Configurazione Database PostgreSQL
- [x] Creare action `setup/database` per inizializzazione schema
- [ ] Creare tabelle: users, contacts, orders
- [ ] Aggiungere PostgreSQL all'endpoint setup

### Fase 2: Autenticazione Utenti
- [ ] Creare action `v1/register` per registrazione
- [ ] Creare action `v1/login` per login
- [ ] Creare action `v1/me` per informazioni utente
- [ ] Implementare hash password con bcrypt
- [ ] Implementare gestione sessione/token

### Fase 3: CRUD Contatti
- [ ] Creare action `v1/contacts` per gestione contatti
- [ ] Supportare GET (lista), POST (crea), PUT (aggiorna), DELETE (elimina)
- [ ] Filtrare per user_id autenticato

### Fase 4: CRUD Ordini
- [ ] Creare action `v1/orders` per gestione ordini
- [ ] Supportare GET (lista), POST (crea), PUT (aggiorna), DELETE (elimina)
- [ ] Filtrare per user_id autenticato
- [ ] Collegare a contatti se presente

### Fase 5: Frontend - Login/Registro
- [ ] Creare pagina Login
- [ ] Creare pagina Register
- [ ] Implementare gestione stato autenticazione
- [ ] Proteggere route private

### Fase 6: Frontend - Contatti
- [ ] Creare pagina Lista Contatti
- [ ] Creare componente Form per aggiunta/modifica contatto
- [ ] Implementare eliminazione contatto

### Fase 7: Frontend - Ordini
- [ ] Creare pagina Lista Ordini
- [ ] Creare componente Form per aggiunta/modifica ordine
- [ ] Implementare eliminazione ordine
- [ ] Mostrare dettagli ordine con contatto associato

### Fase 8: Testing e Validazione
- [ ] Testare tutti gli endpoint API
- [ ] Verificare autenticazione e autorizzazione
- [ ] Testare CRUD completo contatti e ordini
- [ ] Validare UI/UX

## Comandi Utili

```bash
# Setup database
timeout 120 ops ide setup

# Deploy action
timeout 120 ops ide deploy

# Check validazione
timeout 60 check_openserverless_actions.sh .

# Test endpoint
curl http://localhost:5173/api/my/v1/register
```

## Note Iterazioni

### Iterazione 1 - Oggi
- Creare spec.md (completato)
- Creare implementation_plan.md (completato)
- Eseguire implementazione completa delle fasi 1-7
