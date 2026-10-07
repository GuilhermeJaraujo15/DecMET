# Plano de Firewall DecMET — aplicação manual

Preparado em 07/10/2026. Nenhuma regra foi aplicada à conta e nenhum deployment foi criado.

## Antes de aplicar

No projeto correto, confirmar plano, domínios/aliases, deployment ID, SHA, branch e regras existentes.
O repositório não comprova o artefato atualmente publicado. Não publicar a árvore de trabalho por
engano: ela já continha mudanças locais antes deste hardening.

O WAF executa antes da Function. Um limitador Express não evitaria a invocação e por isso não foi
adicionado como solução para essa métrica. Rewrites restritos evitam o encaminhamento de paths
desconhecidos, mas seus 404 ainda representam tráfego na CDN. A entrada física `/api/index` ou
`/api/index.js` pode continuar acessível dependendo do artefato gerado; bloquear o acesso direto
na borda com a regra de paths desconhecidos e verificar que rewrites internos continuam funcionando.

## Regras prontas para montar no dashboard

Abrir Project → Firewall → Configure → New Rule. Usar o campo Request Path (sem query string).
Começar com **Log**, comparar clientes legítimos, revisar mudanças e só então publicar a ação de
bloqueio/rate limit. Publicar é uma operação manual que exige autorização do responsável.

### Perfil Hobby: no máximo três regras, uma de rate limiting

1. **decmet-unknown-api**
   - IF Request Path starts with `/api/` AND Request Path does NOT match:
     `^/api/(health|metar/[A-Za-z]{4}|aeroportos(/(search|sugestoes|icao/[A-Za-z]{4}|[0-9]{1,10}))?)/?$`
   - THEN Log inicialmente; depois Deny.
   - Inclui `/api/wp-admin`, `/api/login`, `/api/random`, `/api/.env` e entrada física da Function.
   - Usar negação do operador Matches no construtor. Se a UI do plano não oferecer regex,
     o rewrite restrito já evita encaminhamento dos paths desconhecidos; usar condições de
     paths exatos para scanners observados, sem prometer a mesma cobertura do predicado acima.
2. **decmet-api-methods**
   - IF Request Path starts with `/api/` AND Request Method is NOT IN `GET, HEAD, OPTIONS`.
   - THEN Log inicialmente; depois Deny. Nenhuma API atual usa POST, PUT ou DELETE.
3. **decmet-api-budget**
   - IF Request Path equals `/api/aeroportos` OR starts with `/api/`.
   - THEN Rate Limit; estratégia Fixed Window; janela **60 segundos**; limite **240**;
     counting key **IP**; ação excedente **Log**, depois **Default 429**.
   - É um teto agregado por IP/região, não por URL completa. Não incluir query string ou ICAO
     na chave: um scraper poderia trocá-los para reiniciar o contador.

240/min é uma hipótese inicial conservadora, não um limite medido do público. O autocomplete
tem debounce de 300 ms e cache local; uma pessoa digitando continuamente pode produzir perto
de 200 chamadas/min em condições extremas. NAT de escola, empresa ou rede móvel pode concentrar
muitas pessoas no mesmo IP. Observar 24–48 h quando houver tráfego normal, percentis por IP e
reclamações antes de passar de Log para 429. Sob abuso ativo, o operador decide uma janela menor.
Log não impede consumo. Não usar Challenge indiscriminadamente nas APIs JSON: fetch pode receber HTML.

### Perfil Pro, se o plano e a quantidade de regras permitirem

Substituir o limite agregado por grupos mutuamente exclusivos, mantendo regras de path/método:

| Grupo de path | Limite inicial por IP / 60 s | Justificativa |
|---|---:|---|
| `/api/metar/…` | 60 | Consulta manual, sem polling; várias pessoas por NAT |
| `/api/aeroportos/sugestoes` | 240 | Digitação pausada e redes compartilhadas |
| `/api/aeroportos` e demais subrotas, excluindo sugestões | 120 | Pesquisa/detalhe após ação explícita |
| `/api/health` | 30 | Monitores devem preferir intervalo de 60 s ou mais |

Também começar pelo Log. IP é preferível a JA4 como chave inicial: clientes distintos podem
compartilhar fingerprint. Não bloquear países ou User-Agents sem evidência. Não criar bypass
amplo para monitores; um bypass pode eliminar outras proteções.

## Disponibilidade e limites consultados

A documentação atual informa uma regra de rate limiting e três custom rules no Hobby; Pro tem
40 regras de rate limiting. Fixed Window existe em todos os planos; Token Bucket é Enterprise.
Contadores são regionais: um emissor distribuído pode exceder o teto agregado global imaginado.
Verificar os limites efetivos no dashboard antes de aplicar e considerar regras já existentes.
[WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Tráfego mitigado por deny/challenge/rate limit não incorre em CDN Requests/FDT segundo a página
atual de uso; tráfego permitido e desafios resolvidos têm contagem normal. Rate limiting também
tem sua própria franquia/cobrança. Não estimar economia somente pela quantidade de bloqueios.
[Uso e preços do WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing).

## Verificação após publicação autorizada em preview

1. Registrar deployment ID/SHA e conferir `public` como output e somente `api/index.js` como Function.
2. Fazer poucos GETs sequenciais ao MESMO endpoint, mesma query, Origin e região; inspecionar
   `x-vercel-cache` e `Age`. DevTools com Disable cache/Pragma no-cache pode forçar revalidação.
3. METAR: primeira chamada deve ser MISS; seguintes podem ser HIT; expiração admite STALE/SWR.
   `Vercel-CDN-Cache-Control` é consumido pela plataforma e pode não aparecer na resposta pública.
4. Testar health, busca/sugestões, detalhe e 404 negativo meteorológico. Não usar loops contra provedores.
5. `/api/random`, `/api/wp-admin`, `/api/.env`, `/api/aeroportos/login`: 404 de borda ou bloqueio WAF,
   sem log `api_response`. Confirmar também que `/api/index` e `/api/index.js` diretos estão bloqueados.
6. `/metar.html` e `/metar.html?icao=SBGR`: 200, nenhum Location. URLs antigas podem ter um redirect,
   cujo destino deve ser 200. Não reintroduzir canonicalização por redirect da query `icao`.
7. Verificar todas as APIs reais após ativar a regra de paths: ela deve inspecionar o path original,
   não bloquear o destino interno `/api/index.js` do rewrite.
8. Exportar por janela: CDN requests/status/path; Function Invocations; `api_response` por rota/cache;
   `provider_call` por provedor/status; `database_query` e erros; WAF mitigados/permitidos e IP/ASN.
9. Ao desativar uma regra problemática, preservar evidências. Não desligar todas as proteções em conjunto.

## Limites remanescentes

O Express não pode normalizar a chave de uma requisição ANTES da consulta ao cache da CDN.
Host, path, query, variantes de codificação e Vary (inclusive Origin do CORS) ainda podem fragmentá-la.
Frontend usa ICAO/termos normalizados e somente `q`; backend rejeita provider, campos desconhecidos,
arrays, objetos e `q` junto com `search`, sem redirect. Os aliases documentados continuam válidos.
Um 400 no Express já custou uma invocação: regras da borda continuam necessárias.

Caches, circuit breaker e single-flight do Node são por instância; não são cotas globais. Sem WAF,
milhões de requests externos ainda podem gerar consumo, mesmo com as amplificações internas removidas.
