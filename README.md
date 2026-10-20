# rallyGallery

Galeria zdjęć z rajdu. Next.js na VPS, Postgres w osobnym kontenerze, pliki zdjęć w Cloudflare R2.

## Lokalnie

```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Aplikacja: http://127.0.0.1:3000  
Baza lokalna: `localhost:5433` (patrz `.env.example`).

## Deploy na VPS

`./deploy/deploy.sh` odpalasz na VPS, w katalogu tego repozytorium. Obrazy budują się na serwerze. Stack stoi obok devilSpy. Postgres nie ma portu na hoście. Aplikacja słucha tylko na `127.0.0.1:18082`, publiczny ruch idzie przez Caddy od devilSpy.

`deploy/.env.prod` jest w `.gitignore` i zostaje na serwerze między wersjami.

### Pierwsza wersja

1. Koszyk R2 w panelu Cloudflare i klucz API (S3). Bez R2 pliki lądują w `./storage` w kontenerze i znikają przy następnym deployu. `R2_PUBLIC_BASE_URL` sprawia, że przeglądarka bierze WebP wprost z R2.

2. Na VPS:

```bash
git clone https://github.com/bobg-dp/rallyGallery.git
cd rallyGallery
cp deploy/.env.prod.example deploy/.env.prod
```

W `deploy/.env.prod` uzupełnij:

- `POSTGRES_PASSWORD` — bez znaków `@ : / # ? $`, bo hasło wchodzi surowo do `DATABASE_URL`
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` — dokładny publiczny adres, razem z `https://`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EDITOR_EMAIL`, `EDITOR_PASSWORD` — login, nie musi być adresem e-mail
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` — bez ukośnika na końcu

3. Deploy i jednorazowy seed kont:

```bash
./deploy/deploy.sh
./deploy/deploy.sh seed
```

`deploy` zakłada wolumen Postgresa (`rallygallery_db_data`), odpala migracje z `drizzle/` i startuje aplikację. `seed` tworzy administratora i edytora, jeśli tych maili jeszcze nie ma. `SEED_DEMO` zostaw na `0`.

4. Rekord DNS domeny z `AUTH_URL` na ten VPS. Porty 80 i 443 są już zajęte przez Caddy devilSpy.

5. Caddy, po pierwszym `deploy` — dopiero wtedy istnieje sieć `rallygallery_internal`. Dopisz sieć i blok strony z `deploy/Caddyfile.snippet` do `proxy/` devilSpy, potem w tym katalogu:

```bash
docker compose up -d
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Caddy musi być w sieci `rallygallery_internal` i proxować na `web:3000`.

6. Sprawdzenie na VPS, potem logowanie w przeglądarce kontem z seeda:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18082/login
```

### Kolejna wersja

Na VPS, w tym samym katalogu. `deploy/.env.prod` nie nadpisuj. Nowe zmienne z `deploy/.env.prod.example` dopisz ręcznie, zanim odpalisz skrypt.

```bash
git pull
./deploy/deploy.sh
```

Skrypt taguje bieżący obraz jako `rallygallery_web:rollback`, buduje nowy z aktualnego kodu, zostawia bazę i pliki w R2, dogrywa nowe migracje i podmienia kontener aplikacji. Numer w stopce to `version` z `package.json` i skrót commita, wbite w obraz przy tym buildzie.

`seed` odpalasz ponownie tylko po to, żeby dodać konto, którego jeszcze nie ma. Istniejących użytkowników nie zmienia.

### Rollback

```bash
./deploy/deploy.sh rollback
```

Przywraca poprzedni obraz aplikacji. Migracji nie cofa. Jeśli nowa wersja zdążyła dograć migrację, stary obraz może nie działać na nowszym schemacie.
