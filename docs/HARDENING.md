# Implementação do hardening DecMET

## Base e escopo

Branch inicial: `vercel-hardening`. HEAD/base Git: `6df284fa7971fafd1bee2483bb2ecfafdce48581`.
Comparação antes de editar: a árvore local equivalia a `a9d1b19` (11/09/2026), exceto README e
finais de linha, apesar de HEAD ser o hardening de 15/09/2026. `api/index.js` e `apiMet.js`
não tinham diferenças semânticas nessa comparação; os demais arquivos solicitados foram comparados
explicitamente. Não há identificação autenticada do deployment de produção nesta sessão.

Foram reaproveitados seletivamente de `6df284f`: headers de cache, single-flight, limite do Map,
deadline absoluto HTTP, reserva NOAA, escape LIKE/prepared statements, validação de tipos/IDs,
proteção do pool substituto, cancelamento/revisões do autocomplete e testes node:test.
O código antigo ainda tinha TTL METAR em memória, stale em erros, pool por instância e debounce;
essas funcionalidades foram preservadas e fortalecidas. Nenhum reset/checkout global foi usado.
README, HTML/CSS, decodificador, CSVs e mudanças locais não relacionadas foram preservados.

## Mudanças e métricas afetadas

| Implementação | Métrica reduzida / limite |
|---|---|
| Sete rewrites explícitos, com regex para ICAO/ID | Invocações por paths desconhecidos; não elimina requests que chegam à CDN |
| Remoção do self-redirect METAR, também no servidor local | Requests CDN causados por redirect circular |
| Cache compartilhado de respostas elegíveis | Function Invocations; indiretamente chamadas externas/queries |
| Single-flight por ICAO normalizado | Chamadas REDEMET/NOAA; não reduz invocações já iniciadas |
| Negative cache, cooldown e circuito de provedor | Chamadas externas em repetição/falha |
| Prefixos brasileiros determinísticos | Tentativas REDEMET desnecessárias; zero query adicional MySQL |
| Fim do fallback cadastral fictício | Requests frontend, invocações e queries Aiven |
| Debounce, cancelamento, deduplicação e cache de sugestões | Requests frontend/CDN, invocações e queries |
| Validação/escape SQL antes de adquirir conexão | Queries inválidas/abrangentes; não evita invocação já recebida |
| Pool protegido e deadline HTTP | Churn de conexões, trabalho pendente e duração; não é limitador de invocações |
| Plano de WAF manual | Tráfego abusivo antes da Function, conforme regra/plano |

Não há novo framework, dependência runtime, autenticação obrigatória, polling ou retry automático.

## Cache final

Valores centralizados em `backend/src/config/policy.js`. Browser e CDNs intermediárias recebem
`public, max-age=0, must-revalidate`. A Vercel recebe os valores abaixo no header prioritário
`Vercel-CDN-Cache-Control`. A regra padrão é `no-store` nos três headers; handlers optam pelo cache.

| Resposta | Cache compartilhado |
|---|---|
| METAR sucesso fresco | `public, s-maxage=30, stale-while-revalidate=15`, reduzidos pela validade restante |
| METAR comprovadamente sem reporte recente, 404 `NO_METAR_FOUND` | `public, s-maxage=20, must-revalidate`, reduzido pelo negativo restante |
| METAR stale servido pelo Node | `no-store`, com `cache.stale=true` e aviso |
| Falha transitória/5xx/429/validação/CORS/404 genérico | `no-store` |
| Pesquisa e sugestões aeroportos, inclusive resultado vazio válido | `public, s-maxage=300, must-revalidate` |
| Detalhe aeroporto encontrado por ID/ICAO | `public, s-maxage=3600, must-revalidate` |
| Health (liveness, sem banco/provedor) | `public, s-maxage=15, must-revalidate` |

O TTL em memória METAR é 60 s; `METAR_CACHE_TTL_SECONDS` permite reduzi-lo, limitado ao teto de 60 s.
O cache compartilhado não soma novamente toda a validade em cada hit do Node: usa tempo restante.
SWR é limitado ao restante dessa mesma validade. Negative cache significa ausência de METAR recente,
não comprovação de que o aeródromo não existe. Timeout, 429 e 5xx nunca se tornam 404 negativo.

Decisão sobre stale-if-error: as páginas atuais de headers e CDN confirmam suporte (resultados antigos
do buscador ainda indicavam o contrário). Avaliamos a diretiva, mas não a enviamos neste contrato METAR:
ela poderia servir um JSON antigo ainda marcado como fresco, sem o aviso explícito produzido pelo Node.
O Node serve stale explicitamente por até cinco minutos depois da expiração; SWR da CDN só cobre
a janela curta indicada. Isso evita prolongar stale recursivamente ou ocultar seu aviso. A confirmação
de HIT real e comportamento regional só pode ocorrer num deployment autorizado.

Referências consultadas em 07/10/2026:
[headers e precedência](https://vercel.com/docs/caching/cache-control-headers),
[CDN cache](https://vercel.com/docs/caching/cdn-cache),
[rewrites](https://vercel.com/docs/routing/rewrites).

## Consulta METAR e falhas

```
validar → cache fresco → resposta
        → negativo/cooldown vigente → 404 / stale / erro transitório
        → Promise do ICAO em andamento → aguardar a mesma Promise
        → consultar provedor com deadline → sucesso / fallback / falha
        → atualizar cache/cooldown → remover Promise em finally
```

Sem trabalho assíncrono solto depois de responder: requests concorrentes aguardam a mesma operação.
Após falha elegível, stale continua disponível, mas novas tentativas do ICAO ficam suspensas por 15 s.
O erro transitório original é preservado em memória durante esse intervalo, sem cache HTTP do erro.
Ausência confirmada de reporte fica 20 s no cache negativo. Cada Map de resultados/falhas tem teto
de 1.000 entradas; há no máximo 100 ICAOs em voo por instância. Excesso recebe 503 no-store.

Após três falhas consecutivas de um provedor, seu circuito fica aberto 30 s. Depois apenas uma
sondagem é permitida; sucesso reabre o tráfego, falha fecha por outro intervalo. Uma resposta
`NO_METAR_FOUND` indica provedor respondendo e não abre o circuito. Resultados tardios de chamadas
iniciadas antes da abertura não podem fechar um circuito de geração mais nova. Fallback NOAA continua.
Não há retry dentro da operação nem estado compartilhado entre instâncias.

Deadline global: 12 s dentro da Function de 15 s. REDEMET dispõe de até 9 s; NOAA recebe o saldo,
com 3 s reservados. Não se inicia NOAA com menos de 500 ms. Timeout absoluto cobre conexão e corpo;
respostas interrompidas falham e respostas acima de 1 MiB são abortadas. Timeouts de provedor por env
continuam possíveis, mas nunca ampliam o deadline total.

Roteamento barato: `SB, SD, SI, SJ, SN, SS, SW` são os prefixos brasileiros; `SCEL`, `SAEZ`, `SPJC`,
`SUMU`, `KJFK` vão diretamente à NOAA. Não foi adicionada query MySQL. A função compartilhada mantém
o contrato METAR de quatro letras; códigos DECEA alfanuméricos não foram adicionados nesta tarefa.
[DECEA AIC N45/2024](https://aisweb.decea.mil.br/eaip/20-2026_2026_10_01/eAIC/N%2045-2024_2024_11_28/AIC-en-GB.html).

## Frontend, SQL e pool

`public/js/shared/api-contract.js` é importado pelo browser e pelo backend. Normaliza caixa/espaços,
limita a 100 caracteres; sugestões aceitam duas letras ou três caracteres com conteúdo alfanumérico;
busca completa exige três caracteres. `%`/`_` são literais no SQL, não operadores fornecidos pelo cliente.
Arrays, objetos, parâmetros desconhecidos, `provider`, `q` junto com `search` e termos inválidos
são rejeitados antes do banco. `q` e o alias histórico `search` continuam suportados separadamente.

O frontend envia somente uma busca cadastral e registra DATABASE, não REDEMET/NOAA. Submit/seleção
cancelam timer e abortam autocomplete. Revisões descartam respostas atrasadas mesmo se abort não
interromper o fetch; trava evita submit simultâneo. Sugestões possuem até 50 termos por aba, TTL 60 s.
METAR também bloqueia submit simultâneo e descarta resposta após mudança de input.

SQL manteve prepared statements, LIMIT e ordenação. FULLTEXT não foi adotado: mudaria busca parcial
e relevância, e não houve acesso seguro para EXPLAIN. Não afirmar ganho de plano sem medi-lo.
Pool mantém duas conexões por instância e timeout de conexão 10 s, libera em finally e só fecha o
pool que efetivamente falhou. Não há mudança de schema ou acesso ao banco de produção.

## Roteamento e observabilidade

Rewrites usam capturas sem nome, evitando parâmetros extras injetados pela Vercel. O compilador
público trata capturas sem nome separadamente de parâmetros nomeados:
[routing-utils](https://github.com/vercel/vercel/blob/main/packages/routing-utils/src/superstatic.ts).
Nenhum redirect limpa query das APIs. `/metar.html?icao=SBGR` serve a página sem consulta automática.
As rotas aceitam uma barra final opcional, preservando o comportamento Express sem novo redirect.

Logs JSON: `api_response` (rota lógica, status, duração, cache HIT/MISS/SHARED/STALE/NEGATIVE_HIT/COOLDOWN),
`provider_call` (uma entrada por tentativa efetiva de provedor, status, timeout, duração, ICAO),
`database_query` (uma por tentativa de SELECT, rota, status, duração), `database_error` sanitizado.
Sem IP, query completa, headers, URL de provedor, mensagem arbitrária, chave ou credencial.
`provider_call` mede tentativas de integração; uma falha `REDEMET_API_KEY_MISSING` ocorre antes de HTTP
e deve ser excluída ao contar requests efetivamente enviados ao provedor.
HIT da CDN não executa Node e não aparece nos logs da Function. O campo cache do JSON descreve
a geração da resposta; para cache CDN usar `x-vercel-cache`/Observability, não esse campo.

Os testes não carregam .env, exigem mocks do banco e usam somente servidores loopback ou mocks.
Não foi rodado teste de carga contra Vercel, NOAA, REDEMET ou Aiven.

## Operação e limites

Aplicar manualmente [o plano WAF](VERCEL-FIREWALL.md) após revisão. Fazer validação curta de preview
autorizado antes de produção: paths, headers HIT/MISS, redirects, CORS e WAF. Sem deploy nesta etapa.
Cabeçalho elegível não comprova HIT observado na infraestrutura real. Entrada física da Function,
variantes de query/host/Origin e instâncias novas são riscos residuais documentados no plano.
Rate limiting não foi adicionado no Express para fingir prevenção de invocações.

## Verificação executada

- `git status`, branch/HEAD/log e diffs específicos contra `a9d1b19` e `6df284f` antes de alterar.
- `npm ci --ignore-scripts --no-audit --no-fund`: dependências do lockfile existente, sem troca de versões.
- `npm test`: node:test, mocks isolados, HTTP local e testes de concorrência.
- `npm run check`: sintaxe dos arquivos runtime, frontend e testes, sem executar aplicação.
- Revisão do diff completo e `git diff --check`.
- Compilação dos sete padrões com `path-to-regexp` 6.3.0 em memória, sem adicionar dependência;
  casos válidos/inválidos e ausência de capturas nomeadas verificados.

Cobertura: cache HIT/MISS e headers, 100 concorrentes → uma chamada, stale concorrente/recuperação,
negative cache versus timeout/429/5xx, circuito e sondagem, prefixos, fallback/deadline, stream lento,
resposta truncada/grande, SQL/validação/escape, pool substituto, cancelamento/frontend, redirect e rotas.

Resultado final: **52 testes passaram, zero falhas**; sintaxe de **48 arquivos JavaScript** aprovada;
`git diff --check` sem erros. Os testes de carga são mocks por instância, não medição da CDN.

## Arquivos desta implementação

- Configuração: `vercel.json`, `package.json`, novo `backend/src/config/policy.js`.
- Backend: `app.js`, controllers METAR/aeroportos, `db.js`, `local-static.js`, serviços REDEMET/NOAA.
- Helpers recuperados: `utils/http-cache.js`, `utils/request-text.js`.
- Helpers novos: `utils/provider-guard.js`, `utils/query-contract.js`, `utils/observability.js`.
- Frontend: `public/js/aerodromo.js`, `public/js/apiMet.js`, novo `public/js/shared/api-contract.js`.
- Verificação: testes recuperados/ampliados em `tests/`, novo `tests/policy.test.js`,
  novo `scripts/check-syntax.js`.
- Documentação: este relatório e `docs/VERCEL-FIREWALL.md`.

Alguns arquivos recuperados são idênticos a HEAD e por isso não aparecem no diff final, embora
estivessem alterados/deletados na árvore inicial. As diferenças de README e public/index.html
já existiam antes da implementação. Nenhum commit, push, deploy ou alteração na conta/banco foi feito.
