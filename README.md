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

Osobny stack Dockera obok devilSpy. Postgres nie ma portu na hoście.

```bash
cp deploy/.env.prod.example deploy/.env.prod
# uzupełnij hasła, AUTH_URL i klucze R2
./deploy/deploy.sh
./deploy/deploy.sh seed
```

Rollback poprzedniego obrazu aplikacji:

```bash
./deploy/deploy.sh rollback
```

Na serwerze aplikacja słucha tylko na `127.0.0.1:18082`. Publiczny ruch idzie przez Caddy, który już stoi przy devilSpy. Blok do dopisania jest w `deploy/Caddyfile.snippet`. Caddy musi być podłączone do sieci `rallygallery_internal` i proxować na `web:3000`.

Koszyk R2 zakładasz w panelu Cloudflare. Klucze API (S3) trafiają do `deploy/.env.prod`, nie do repo. `R2_PUBLIC_BASE_URL` sprawia, że przeglądarka bierze WebP wprost z R2.
