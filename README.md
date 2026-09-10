# DecMET

Sistema web para consulta e decodificação de mensagens METAR, com frontend estático e API Node.js/Express.

## Arquitetura

```text
Vercel
├── Static CDN
│   ├── public/index.html
│   ├── public/metar.html
│   ├── public/decoder.html
│   ├── public/about-metar.html
│   ├── public/airports.html
│   ├── public/sitemap.xml
│   ├── public/robots.txt
│   ├── public/css
│   ├── public/js
│   └── public/assets
└── Serverless API
    └── api/index.js
        └── backend/src/app.js
            ├── /api/health
            ├── /api/metar/:icao
            └── /api/aeroportos/**
```

## Desenvolvimento Local

```bash
npm install
npm run dev
```

O servidor local entrega o frontend estático de `public/` e expõe as APIs em `/api/**`.

## Build

```bash
npm run build
```

O build compila o Tailwind para `public/css/tailwind.css` e não consulta MySQL, REDEMET ou NOAA.

## Produção/Vercel

- `public/` é o output estático.
- `api/index.js` é o entrypoint serverless.
- `vercel.json` preserva redirects 301 históricos e roteia `/api/**` para a API Express.
- URLs canônicas continuam apontando para `https://decmet.com.br`.
- URLs `*.vercel.app` recebem `X-Robots-Tag: noindex, nofollow`.

Configure as variáveis de ambiente na Vercel. Use `backend/.env.example` apenas como referência local, nunca com valores reais versionados.

