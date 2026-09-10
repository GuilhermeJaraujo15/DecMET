# DecMET Backend

Backend Express usado pela API serverless do DecMET.

Os comandos de instalação, desenvolvimento e build ficam no `package.json` do root:

```bash
npm install
npm run dev
npm run build
```

Entrypoints:

- `backend/src/app.js`: cria e exporta a aplicação Express usada pela Vercel.
- `backend/server.js`: servidor local com `app.listen()`.
- `api/index.js`: entrypoint da Vercel Function.

Variáveis de ambiente ficam documentadas em `backend/.env.example`. O arquivo real `backend/.env` é local, sensível e ignorado pelo Git.

