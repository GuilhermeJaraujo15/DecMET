(function () {
  const STORAGE_KEY = "decmet.language";
  const DEFAULT_LANGUAGE = "pt-BR";
  const SUPPORTED_LANGUAGES = ["pt-BR", "en-US"];

  const translations = {
    "pt-BR": {
      "common.language.label": "Idioma",
      "common.language.pt": "PT",
      "common.language.en": "EN",
      "nav.main": "Navegação principal",
      "nav.home": "Início",
      "nav.whatIsMetar": "METAR?",
      "nav.airports": "Aeródromos",
      "nav.metarQuery": "Consulta",
      "nav.decoder": "Decodificador",
      "home.title": "DecMET | Guia de Uso para Decodificar METAR e Buscar ICAO",
      "home.hero.eyebrow": "Portal meteorológico aeronáutico",
      "home.hero.heading": "DecMET: guia de uso para meteorologia aeronáutica",
      "home.hero.subtitle": "Decodificação METAR clara, leve e operacional.",
      "home.hero.body": "O DecMET organiza o reporte bruto em partes identificadas e descrições legíveis para apoiar consultas rápidas de meteorologia aeronáutica.",
      "home.hero.cta": "Decodificar METAR",
      "home.orientation.eyebrow": "ORIENTAÇÃO DO SISTEMA",
      "home.orientation.heading": "Como o DecMET ajuda na leitura do reporte",
      "home.step1.title": "1. Cole o METAR",
      "home.step1.body": "Use a página Decodificador para inserir o reporte bruto exatamente como recebido.",
      "home.step2.title": "2. Confira as partes",
      "home.step2.body": "O sistema separa o código em grupos de vento, visibilidade, tempo, nuvens, temperatura e pressão.",
      "home.step3.title": "3. Leia a tradução",
      "home.step3.body": "Cada grupo recebe uma descrição em linguagem direta para estudo e consulta operacional.",
      "home.step4.title": "4. Revise alertas",
      "home.step4.body": "Tokens desconhecidos ou suspeitos são destacados para revisão manual do reporte.",
      "home.recommended.title": "Uso recomendado",
      "home.recommended.body": "Siga o fluxo ideal do sistema em três passos e use cada página no seu propósito:",
      "home.recommended.flow": "DecMET\n├─ Aeródromos\n│  └─ Busque o nome do aeródromo e copie/registre o código ICAO\n├─ Consulta METAR\n│  └─ Use a página para obter o METAR mais recente via NOAA (National Oceanic and Atmospheric Administration)\n└─ Decodificador\n   ├─ Cole o METAR bruto recebido\n   ├─ Verifique vento, visibilidade, nuvens, temperatura, pressão e tendências\n   └─ Revise alertas e tokens não reconhecidos para validação final",
      "about.title": "O que é METAR? Como Interpretar Reportes Aeronáuticos | DecMET",
      "about.hero.eyebrow": "Guia educacional",
      "about.hero.heading": "O que é METAR e como interpretar reportes aeronáuticos",
      "about.hero.subtitle": "Conheça a estrutura dos reportes meteorológicos aeronáuticos",
      "about.hero.body": "Use esta página para compreender os principais grupos de informação presentes em um METAR, como vento, visibilidade, tempo significativo, nuvens, temperatura e pressão. Após entender a estrutura, você estará preparado para usar as ferramentas de consulta e decodificação.",
      "about.quick.eyebrow": "REFERÊNCIA RÁPIDA",
      "about.quick.heading": "O que é METAR?",
      "about.quick.body": "METAR é um reporte meteorológico padronizado usado na aviação para informar condições observadas em aeródromos. Ele agrupa dados como vento, visibilidade, tempo presente, nuvens, temperatura, ponto de orvalho e pressão.",
      "about.tree.eyebrow": "ÁRVORE DE CONHECIMENTO METAR",
      "about.tree.heading": "Entenda cada fatia do reporte meteorológico aeronáutico com este exemplo a seguir:",
      "about.tree.exampleLabel": "Exemplo METAR interativo",
      "about.tree.selected": "Segmento selecionado",
      "about.tree.note": "Nota técnica",
      "about.tree.grouped": "Árvore agrupada",
      "about.tree.identification": "Identificação",
      "about.tree.wind": "Condições de vento",
      "about.tree.visibility": "Visibilidade",
      "about.tree.weather": "Tempo presente",
      "about.tree.clouds": "Nuvens / visibilidade vertical",
      "about.tree.temperaturePressure": "Temperatura e pressão",
      "about.knowledge.METAR.category": "Tipo de relatório",
      "about.knowledge.METAR.explanation": "Relatório meteorológico regular de aeródromo.",
      "about.knowledge.METAR.note": "Indica que o reporte segue o formato padronizado METAR.",
      "about.knowledge.SBGR.category": "Identificador da estação",
      "about.knowledge.SBGR.explanation": "Código ICAO do Aeroporto de Guarulhos.",
      "about.knowledge.SBGR.note": "O primeiro identificador de quatro letras aponta a estação meteorológica ou aeródromo.",
      "about.knowledge.252100Z.category": "Data e hora do reporte",
      "about.knowledge.252100Z.explanation": "Dia 25, às 21:00 UTC.",
      "about.knowledge.252100Z.note": "O sufixo Z indica horário Zulu, equivalente ao UTC.",
      "about.knowledge.09003KT.category": "Vento",
      "about.knowledge.09003KT.explanation": "Vento vindo de 090° com velocidade de 3 nós.",
      "about.knowledge.09003KT.note": "Os três primeiros dígitos indicam a direção e os seguintes indicam a velocidade.",
      "about.knowledge.0500.category": "Visibilidade predominante",
      "about.knowledge.0500.explanation": "Visibilidade horizontal de 500 metros.",
      "about.knowledge.0500.note": "Valores de quatro dígitos, em METAR internacional, normalmente indicam metros.",
      "about.knowledge.0200N.category": "Visibilidade direcional",
      "about.knowledge.0200N.explanation": "Visibilidade de 200 metros na direção norte.",
      "about.knowledge.0200N.note": "A letra final informa o setor direcional associado à visibilidade.",
      "about.knowledge.FG.category": "Tempo presente",
      "about.knowledge.FG.explanation": "Nevoeiro.",
      "about.knowledge.FG.note": "FG identifica fog, usado quando há redução importante de visibilidade.",
      "about.knowledge.VV002.category": "Visibilidade vertical",
      "about.knowledge.VV002.explanation": "Visibilidade vertical de 200 pés.",
      "about.knowledge.VV002.note": "VV seguido de três dígitos representa centenas de pés.",
      "about.knowledge.12/12.category": "Temperatura / ponto de orvalho",
      "about.knowledge.12/12.explanation": "Temperatura de 12°C e ponto de orvalho de 12°C.",
      "about.knowledge.12/12.note": "Quando os valores se igualam, o ar está saturado ou muito próximo disso.",
      "about.knowledge.Q1016.category": "Pressão atmosférica",
      "about.knowledge.Q1016.explanation": "QNH de 1016 hPa.",
      "about.knowledge.Q1016.note": "O prefixo Q informa pressão em hectopascais.",
      "airports.title": "Buscar Código ICAO e Informações de Aeródromos | DecMET",
      "airports.hero.eyebrow": "Consulta de dados de aeródromos",
      "airports.hero.heading": "Buscar código ICAO e informações de aeródromos",
      "airports.hero.subtitle": "Pesquise aeródromos, aeroportos e helipontos",
      "airports.hero.body": "Digite nome, cidade, país, código ICAO ou IATA para encontrar o aeródromo desejado. O código ICAO é o identificador usado nas consultas meteorológicas. Localize o código certo antes de consultar o METAR.",
      "airports.search.title": "Pesquisar",
      "airports.search.label": "Termo de busca",
      "airports.search.placeholder": "Digite o nome do aeroporto, cidade, país, IATA ou código ICAO",
      "airports.search.button": "Buscar aeródromo",
      "airports.panel.eyebrow": "Consulta de aeródromos",
      "airports.panel.heading": "Localize o código ICAO de aeroportos e aeródromos",
      "airports.panel.body": "Use esta seção para encontrar o código ICAO necessário para futuras consultas METAR no DecMET. A base de aeródromos será estruturada a partir dos dados da OurAirports e consultada por meio do Banco do próprio do sistema.",
      "airports.state.loading": "Buscando aeródromos...",
      "airports.state.empty": "Digite um termo para iniciar a busca.",
      "airports.state.noResults": "Nenhum aeródromo encontrado para essa pesquisa.",
      "airports.state.error": "Não foi possível consultar a base de aeródromos no momento.",
      "airports.demo": "Demonstração",
      "airports.type.airplane": "Aeródromo de avião",
      "airports.type.heliport": "Heliponto",
      "airports.type.seaplane": "Hidrobase",
      "airports.type.balloonport": "Área de balonismo",
      "airports.type.closed": "Aeródromo fechado",
      "airports.type.airport": "Aeródromo",
      "airports.label.icao": "Código ICAO",
      "airports.label.icaoUnavailable": "Código ICAO não disponível",
      "airports.label.iata": "IATA",
      "airports.label.location": "Localização",
      "airports.label.coordinatesAltitude": "Coordenadas & Altitude",
      "airports.value.notInformed": "Não informado",
      "airports.error.identifySelected": "Não foi possível identificar o aeródromo selecionado.",
      "airports.error.loadSelected": "Não foi possível carregar o aeródromo selecionado.",
      "metar.title": "Consultar METAR em Tempo Real com Dados NOAA | DecMET",
      "metar.hero.eyebrow": "Inspeção meteorológica",
      "metar.hero.heading": "Consultar METAR em tempo real com dados NOAA",
      "metar.hero.subtitle": "Entrada operacional preparada para integração via backend DecMET.",
      "metar.hero.body": "Informe um código ICAO para consultar o METAR mais recente.",
      "metar.query.eyebrow": "Consulta operacional",
      "metar.query.heading": "Consulta METAR em tempo real",
      "metar.query.body": "Digite o código ICAO de quatro letras do aeródromo selecionado. A consulta retorna o METAR bruto mais recente.",
      "metar.query.label": "Código ICAO",
      "metar.query.placeholder": "Ex: SBGR",
      "metar.query.button": "Consultar METAR",
      "metar.query.help": "Use apenas quatro letras, como SBGR, SBBR ou SBSP.",
      "metar.state.empty.label": "Aguardando entrada",
      "metar.state.empty.body": "Informe um código ICAO para preparar a consulta METAR.",
      "metar.state.loading.label": "Consultando METAR",
      "metar.state.loading.body": "Buscando o METAR mais recente pelo backend DecMET.",
      "metar.state.error.label": "Entrada inválida",
      "metar.state.result.label": "METAR recebido",
      "metar.state.result.body": "O METAR bruto foi retornado pelo backend e está pronto para cópia ou leitura manual.",
      "metar.result.rawTitle": "METAR bruto",
      "metar.result.copy": "Copiar METAR",
      "metar.result.empty": "METAR aguardando consulta via backend DecMET.",
      "metar.result.noaaTitle": "Dados estruturados NOAA",
      "metar.result.station": "estação/ICAO",
      "metar.result.reportTime": "hora do reporte",
      "metar.result.source": "fonte",
      "metar.result.flightCategory": "categoria de voo",
      "metar.result.defaultTime": "--:-- UTC",
      "metar.result.defaultSource": "Backend DecMET",
      "metar.manual.title": "Decodificação manual",
      "metar.manual.body": "METAR recebido? Copie o código bruto e abra o Decodificador para interpretar a mensagem manualmente.",
      "metar.manual.link": "Abrir Decodificador",
      "metar.notes.title": "Notas operacionais",
      "metar.notes.one": "As consultas externas serão centralizadas no backend DecMET.",
      "metar.notes.two": "A interface não expõe credenciais, configurações ou URLs externas de API.",
      "metar.notes.three": "A camada de servidor poderá aplicar cache, limites e tratamento responsável de requisições.",
      "metar.error.invalidIcao": "Digite exatamente quatro letras para o código ICAO.",
      "metar.error.noRecent": "Nenhum METAR recente foi encontrado para este código ICAO.",
      "metar.error.generic": "Não foi possível consultar o METAR no momento.",
      "metar.error.connection": "Não foi possível conectar ao backend DecMET. Verifique se o servidor está em execução.",
      "metar.error.noRaw": "O backend não retornou um METAR bruto para este código ICAO.",
      "metar.loading": "Consultando...",
      "metar.copy.copied": "Copiado",
      "metar.copy.select": "Selecione e copie",
      "decoder.title": "Decodificar METAR Online e Tradução de METAR | DecMET",
      "decoder.hero.eyebrow": "Ferramenta interceptadora",
      "decoder.hero.heading": "Decodificar METAR online",
      "decoder.hero.subtitle": "Cole um reporte METAR bruto e visualize sua interpretação",
      "decoder.hero.body": "Use esta página para transformar grupos meteorológicos em descrições legíveis, facilitando o estudo e a consulta rápida das condições reportadas. Cole o METAR exatamente como recebido, e o sistema separará os componentes técnicos em uma apresentação operacional.",
      "decoder.input.eyebrow": "ENTRADA METAR",
      "decoder.input.heading": "Decodificador operacional",
      "decoder.input.form": "FORM-METAR-01",
      "decoder.input.label": "Insira o METAR bruto",
      "decoder.input.placeholder": "METAR SBGR 252100Z 09003KT 0500 0200N FG VV002 12/12 Q1016",
      "decoder.input.decode": "Decodificar",
      "decoder.input.clear": "Limpar",
      "decoder.raw.title": "METAR RECEBIDO",
      "decoder.tokens.title": "PARTES IDENTIFICADAS",
      "decoder.decoded.title": "METAR DECODIFICADO",
      "decoder.decoded.table": "Tabela técnica",
      "decoder.table.code": "Código",
      "decoder.table.type": "Tipo",
      "decoder.table.decoding": "Decodificação",
      "decoder.part": "Parte",
      "meta.title.home": "DecMET | Decodificador METAR e Consulta ICAO para Aviação",
      "meta.description.home": "Decodifique METAR online, consulte METAR em tempo real via NOAA e busque códigos ICAO de aeródromos. Ferramenta gratuita para pilotos e entusiastas.",
      "meta.title.decoder": "Decodificador METAR Online | Tradução de Códigos Aeronáuticos",
      "meta.description.decoder": "Traduza METAR para linguagem clara: vento, visibilidade, nuvens, temperatura e pressão. Decodifique relatórios aeronáuticos instantaneamente.",
      "meta.title.aerodromo": "Buscar Código ICAO e Aeródromos | DecMET",
      "meta.description.aerodromo": "Encontre o código ICAO de qualquer aeroporto ou aeródromo. Consulte nome, cidade, país, IATA e coordenadas para suas consultas METAR.",
      "meta.title.metar": "Consultar METAR em Tempo Real com Dados NOAA | DecMET",
      "meta.description.metar": "Obtenha o METAR mais recente por código ICAO diretamente da NOAA. Visualize o relatório bruto e copie para decodificação.",
      "meta.title.about": "O que é METAR? Guia Completo de Interpretação | DecMET",
      "meta.description.about": "Aprenda a interpretar METAR: vento, visibilidade, fenômenos, nuvens, temperatura e pressão. Exemplos práticos e árvore de conhecimento.",
      "metar.dynamic.title": "METAR {{icao}} - {{stationName}} | Decodificado em Tempo Real",
      "metar.dynamic.description": "Confira o METAR mais recente de {{icao}} ({{stationName}}): vento {{wind}}, visibilidade {{visibility}}, temperatura {{temp}}.",
      "airport.dynamic.title": "Aeródromo {{icao}} - {{name}} | Código ICAO e Informações",
      "airport.dynamic.description": "Informações completas do aeródromo {{name}} ({{icao}}): localização, coordenadas, altitude e tipo de operação.",

      "home.tools.title": "Ferramenta de aviação para METAR, ICAO e meteorologia aeronáutica",
      "home.tools.decoding.title": "Decodificar METAR",
      "home.tools.decoding.body": "O DecMET interpreta grupos de vento, visibilidade, tempo presente, nuvens, temperatura, ponto de orvalho e pressão, ajudando pilotos, alunos e entusiastas a entenderem o reporte bruto.",
      "home.tools.icao.title": "Buscar ICAO",
      "home.tools.icao.body": "A busca de aeródromos facilita encontrar o código ICAO correto antes da consulta METAR, reduzindo erros de identificação de estação ou aeroporto.",
      "home.tools.metar.title": "Consultar METAR",
      "home.tools.metar.body": "A consulta em tempo real centraliza o METAR bruto retornado pela API NOAA e prepara a mensagem para leitura manual ou decodificação no próprio sistema.",

      "about.practice.title": "Como interpretar um METAR na prática",
      "about.practice.readByGroups.title": "Leia por grupos, não por palavras soltas",
      "about.practice.readByGroups.body": "Um METAR é organizado em blocos padronizados. Identifique primeiro a estação ICAO, depois data e hora, vento, visibilidade, fenômenos meteorológicos, nuvens, temperatura, ponto de orvalho e pressão.",
      "about.practice.observe.title": "Observe os elementos que afetam a operação",
      "about.practice.observe.body": "Vento forte ou com rajadas, visibilidade reduzida, nevoeiro, trovoada, teto baixo e variação de pressão são sinais importantes para a leitura aeronáutica do tempo observado.",
      "about.practice.useDecMET.title": "Use o DecMET como apoio de estudo",
      "about.practice.useDecMET.body": "Depois de entender a estrutura, utilize a consulta METAR para obter um reporte recente e o decodificador para comparar o código bruto com a interpretação em linguagem direta. Para operações reais, confirme sempre as informações em fontes oficiais.",

      "airports.howto.title": "Como buscar código ICAO de aeródromos",
      "airports.howto.search.title": "Pesquise por nome, cidade, ICAO ou IATA",
      "airports.howto.search.body": "A busca aceita diferentes termos para localizar aeroportos, helipontos e aeródromos. O código ICAO de quatro letras é o identificador usado para consultar METAR.",
      "airports.howto.confirm.title": "Confirme o aeródromo antes da consulta",
      "airports.howto.confirm.body": "Muitos aeródromos possuem nomes parecidos ou códigos regionais. Verifique localização, país, IATA e coordenadas antes de usar o ICAO na consulta METAR.",

      "metar.howto.title": "Consulta METAR em tempo real com dados NOAA",
      "metar.howto.icao.title": "Informe o ICAO correto",
      "metar.howto.icao.body": "A consulta METAR depende do código ICAO de quatro letras da estação. Use a página de aeródromos para confirmar o identificador antes de buscar o reporte.",
      "metar.howto.read.title": "Leia o METAR bruto",
      "metar.howto.read.body": "O retorno preserva a mensagem meteorológica original, permitindo copiar o METAR para análise, treinamento ou decodificação dentro do DecMET.",
      "metar.howto.source.title": "Entenda a fonte dos dados",
      "metar.howto.source.body": "O DecMET consulta dados NOAA AviationWeather e aplica tratamento de resposta e cache, evitando expor integrações externas diretamente no navegador.",

      "decoder.howto.title": "Como decodificar METAR online com o DecMET",
      "decoder.howto.step1.title": "1. Cole o reporte bruto",
      "decoder.howto.step1.body": "Insira o METAR exatamente como recebido, incluindo o tipo de reporte, código ICAO, horário UTC e os grupos meteorológicos.",
      "decoder.howto.step2.title": "2. Revise cada grupo",
      "decoder.howto.step2.body": "A ferramenta identifica vento, visibilidade, alcance visual de pista, nuvens, temperatura, ponto de orvalho, QNH e tendências.",
      "decoder.howto.step3.title": "3. Compare com a operação",
      "decoder.howto.step3.body": "Use a tradução do METAR para leitura rápida, treinamento e conferência, mantendo a validação final em fontes oficiais."
    },
    "en-US": {
      "common.language.label": "Language",
      "common.language.pt": "PT",
      "common.language.en": "EN",
      "nav.main": "Main navigation",
      "nav.home": "Home",
      "nav.whatIsMetar": "METAR?",
      "nav.airports": "Aerodromes",
      "nav.metarQuery": "Lookup",
      "nav.decoder": "Decoder",
      "home.title": "DecMET | Usage Guide to Decode METAR and Find ICAO Codes",
      "home.hero.eyebrow": "Aeronautical weather portal",
      "home.hero.heading": "DecMET: usage guide for aeronautical weather",
      "home.hero.subtitle": "Clear, lightweight, operational METAR decoding.",
      "home.hero.body": "DecMET organizes raw reports into identified parts and readable descriptions to support quick aeronautical weather checks.",
      "home.hero.cta": "Decode METAR",
      "home.orientation.eyebrow": "SYSTEM GUIDANCE",
      "home.orientation.heading": "How DecMET helps read the report",
      "home.step1.title": "1. Paste the METAR",
      "home.step1.body": "Use the Decoder page to enter the raw report exactly as received.",
      "home.step2.title": "2. Check the parts",
      "home.step2.body": "The system separates the code into wind, visibility, weather, cloud, temperature, and pressure groups.",
      "home.step3.title": "3. Read the translation",
      "home.step3.body": "Each group receives a plain-language description for study and operational reference.",
      "home.step4.title": "4. Review alerts",
      "home.step4.body": "Unknown or suspicious tokens are highlighted for manual review of the report.",
      "home.recommended.title": "Recommended use",
      "home.recommended.body": "Follow the ideal three-step system flow and use each page for its purpose:",
      "home.recommended.flow": "DecMET\n├─ Aerodromes\n│  └─ Search for the aerodrome name and copy/register the ICAO code\n├─ METAR Lookup\n│  └─ Use the page to get the latest METAR via NOAA (National Oceanic and Atmospheric Administration)\n└─ Decoder\n   ├─ Paste the raw METAR received\n   ├─ Check wind, visibility, clouds, temperature, pressure, and trends\n   └─ Review alerts and unrecognized tokens for final validation",
      "about.title": "What is METAR? How to Interpret Aviation Reports | DecMET",
      "about.hero.eyebrow": "Educational guide",
      "about.hero.heading": "What is METAR and how to interpret aviation reports",
      "about.hero.subtitle": "Learn the structure of aeronautical weather reports",
      "about.hero.body": "Use this page to understand the main information groups in a METAR, such as wind, visibility, significant weather, clouds, temperature, and pressure. After learning the structure, you will be ready to use the lookup and decoding tools.",
      "about.quick.eyebrow": "QUICK REFERENCE",
      "about.quick.heading": "What is METAR?",
      "about.quick.body": "METAR is a standardized weather report used in aviation to communicate observed conditions at aerodromes. It groups data such as wind, visibility, present weather, clouds, temperature, dew point, and pressure.",
      "about.tree.eyebrow": "METAR KNOWLEDGE TREE",
      "about.tree.heading": "Understand each slice of the aeronautical weather report with this example:",
      "about.tree.exampleLabel": "Interactive METAR example",
      "about.tree.selected": "Selected segment",
      "about.tree.note": "Technical note",
      "about.tree.grouped": "Grouped tree",
      "about.tree.identification": "Identification",
      "about.tree.wind": "Wind conditions",
      "about.tree.visibility": "Visibility",
      "about.tree.weather": "Present weather",
      "about.tree.clouds": "Clouds / vertical visibility",
      "about.tree.temperaturePressure": "Temperature and pressure",
      "about.knowledge.METAR.category": "Report type",
      "about.knowledge.METAR.explanation": "Regular aerodrome meteorological report.",
      "about.knowledge.METAR.note": "Indicates that the report follows the standardized METAR format.",
      "about.knowledge.SBGR.category": "Station identifier",
      "about.knowledge.SBGR.explanation": "ICAO code for Guarulhos Airport.",
      "about.knowledge.SBGR.note": "The first four-letter identifier points to the weather station or aerodrome.",
      "about.knowledge.252100Z.category": "Report date and time",
      "about.knowledge.252100Z.explanation": "Day 25 at 21:00 UTC.",
      "about.knowledge.252100Z.note": "The Z suffix indicates Zulu time, equivalent to UTC.",
      "about.knowledge.09003KT.category": "Wind",
      "about.knowledge.09003KT.explanation": "Wind from 090° at 3 knots.",
      "about.knowledge.09003KT.note": "The first three digits indicate direction and the following digits indicate speed.",
      "about.knowledge.0500.category": "Prevailing visibility",
      "about.knowledge.0500.explanation": "Horizontal visibility of 500 meters.",
      "about.knowledge.0500.note": "Four-digit values in international METAR usually indicate meters.",
      "about.knowledge.0200N.category": "Directional visibility",
      "about.knowledge.0200N.explanation": "Visibility of 200 meters toward the north.",
      "about.knowledge.0200N.note": "The final letter indicates the directional sector associated with visibility.",
      "about.knowledge.FG.category": "Present weather",
      "about.knowledge.FG.explanation": "Fog.",
      "about.knowledge.FG.note": "FG identifies fog, used when visibility is significantly reduced.",
      "about.knowledge.VV002.category": "Vertical visibility",
      "about.knowledge.VV002.explanation": "Vertical visibility of 200 feet.",
      "about.knowledge.VV002.note": "VV followed by three digits represents hundreds of feet.",
      "about.knowledge.12/12.category": "Temperature / dew point",
      "about.knowledge.12/12.explanation": "Temperature of 12°C and dew point of 12°C.",
      "about.knowledge.12/12.note": "When the values are equal, the air is saturated or very close to saturation.",
      "about.knowledge.Q1016.category": "Atmospheric pressure",
      "about.knowledge.Q1016.explanation": "QNH of 1016 hPa.",
      "about.knowledge.Q1016.note": "The Q prefix indicates pressure in hectopascals.",
      "airports.title": "Find ICAO Codes and Aerodrome Information | DecMET",
      "airports.hero.eyebrow": "Aerodrome data lookup",
      "airports.hero.heading": "Find ICAO codes and aerodrome information",
      "airports.hero.subtitle": "Search aerodromes, airports, and heliports",
      "airports.hero.body": "Enter a name, city, country, ICAO code, or IATA code to find the desired aerodrome. The ICAO code is the identifier used in weather queries. Find the right code before checking the METAR.",
      "airports.search.title": "Search",
      "airports.search.label": "Search term",
      "airports.search.placeholder": "Enter airport name, city, country, IATA, or ICAO code",
      "airports.search.button": "Search aerodrome",
      "airports.panel.eyebrow": "Aerodrome lookup",
      "airports.panel.heading": "Find the ICAO code for airports and aerodromes",
      "airports.panel.body": "Use this section to find the ICAO code required for future METAR lookups in DecMET. The aerodrome database is structured from OurAirports data and queried through the system database.",
      "airports.state.loading": "Searching aerodromes...",
      "airports.state.empty": "Enter a term to start searching.",
      "airports.state.noResults": "No aerodrome found for this search.",
      "airports.state.error": "Could not query the aerodrome database right now.",
      "airports.demo": "Demo",
      "airports.type.airplane": "Airplane aerodrome",
      "airports.type.heliport": "Heliport",
      "airports.type.seaplane": "Seaplane base",
      "airports.type.balloonport": "Balloonport",
      "airports.type.closed": "Closed aerodrome",
      "airports.type.airport": "Aerodrome",
      "airports.label.icao": "ICAO Code",
      "airports.label.icaoUnavailable": "ICAO code not available",
      "airports.label.iata": "IATA",
      "airports.label.location": "Location",
      "airports.label.coordinatesAltitude": "Coordinates & Altitude",
      "airports.value.notInformed": "Not informed",
      "airports.error.identifySelected": "Could not identify the selected aerodrome.",
      "airports.error.loadSelected": "Could not load the selected aerodrome.",
      "metar.title": "Real-Time METAR Lookup with NOAA Data | DecMET",
      "metar.hero.eyebrow": "Weather inspection",
      "metar.hero.heading": "Real-time METAR lookup with NOAA data",
      "metar.hero.subtitle": "Operational input prepared for integration through the DecMET backend.",
      "metar.hero.body": "Enter an ICAO code to retrieve the latest METAR.",
      "metar.query.eyebrow": "Operational lookup",
      "metar.query.heading": "Real-time METAR lookup",
      "metar.query.body": "Enter the four-letter ICAO code for the selected aerodrome. The query returns the latest raw METAR.",
      "metar.query.label": "ICAO code",
      "metar.query.placeholder": "Ex: SBGR",
      "metar.query.button": "Check METAR",
      "metar.query.help": "Use only four letters, such as SBGR, SBBR, or SBSP.",
      "metar.state.empty.label": "Waiting for input",
      "metar.state.empty.body": "Enter an ICAO code to prepare the METAR lookup.",
      "metar.state.loading.label": "Checking METAR",
      "metar.state.loading.body": "Fetching the latest METAR through the DecMET backend.",
      "metar.state.error.label": "Invalid input",
      "metar.state.result.label": "METAR received",
      "metar.state.result.body": "The raw METAR was returned by the backend and is ready to copy or read manually.",
      "metar.result.rawTitle": "Raw METAR",
      "metar.result.copy": "Copy METAR",
      "metar.result.empty": "METAR waiting for DecMET backend lookup.",
      "metar.result.noaaTitle": "NOAA structured data",
      "metar.result.station": "station/ICAO",
      "metar.result.reportTime": "report time",
      "metar.result.source": "source",
      "metar.result.flightCategory": "flight category",
      "metar.result.defaultTime": "--:-- UTC",
      "metar.result.defaultSource": "Backend DecMET",
      "metar.manual.title": "Manual decoding",
      "metar.manual.body": "METAR received? Copy the raw code and open the Decoder to interpret the message manually.",
      "metar.manual.link": "Open Decoder",
      "metar.notes.title": "Operational notes",
      "metar.notes.one": "External queries will be centralized in the DecMET backend.",
      "metar.notes.two": "The interface does not expose credentials, settings, or external API URLs.",
      "metar.notes.three": "The server layer can apply caching, limits, and responsible request handling.",
      "metar.error.invalidIcao": "Enter exactly four letters for the ICAO code.",
      "metar.error.noRecent": "No recent METAR was found for this ICAO code.",
      "metar.error.generic": "Could not query the METAR right now.",
      "metar.error.connection": "Could not connect to the DecMET backend. Check whether the server is running.",
      "metar.error.noRaw": "The backend did not return a raw METAR for this ICAO code.",
      "metar.loading": "Checking...",
      "metar.copy.copied": "Copied",
      "metar.copy.select": "Select and copy",
      "decoder.title": "Decode METAR Online and Translate METAR | DecMET",
      "decoder.hero.eyebrow": "Interceptor tool",
      "decoder.hero.heading": "Decode METAR online",
      "decoder.hero.subtitle": "Paste a raw METAR report and view its interpretation",
      "decoder.hero.body": "Use this page to transform meteorological groups into readable descriptions, making it easier to study and quickly check reported conditions. Paste the METAR exactly as received, and the system will separate the technical components into an operational presentation.",
      "decoder.input.eyebrow": "METAR INPUT",
      "decoder.input.heading": "Operational decoder",
      "decoder.input.form": "FORM-METAR-01",
      "decoder.input.label": "Enter the raw METAR",
      "decoder.input.placeholder": "METAR SBGR 252100Z 09003KT 0500 0200N FG VV002 12/12 Q1016",
      "decoder.input.decode": "Decode",
      "decoder.input.clear": "Clear",
      "decoder.raw.title": "RECEIVED METAR",
      "decoder.tokens.title": "IDENTIFIED PARTS",
      "decoder.decoded.title": "DECODED METAR",
      "decoder.decoded.table": "Technical table",
      "decoder.table.code": "Code",
      "decoder.table.type": "Type",
      "decoder.table.decoding": "Decoding",
      "decoder.part": "Part",
      "meta.title.home": "DecMET | METAR Decoder and ICAO Lookup for Aviation",
      "meta.description.home": "Decode METAR online, get real-time METAR via NOAA and search ICAO codes for aerodromes. Free tool for pilots and enthusiasts.",
      "meta.title.decoder": "Online METAR Decoder | Aviation Code Translation",
      "meta.description.decoder": "Translate METAR to plain language: wind, visibility, clouds, temperature and pressure. Decode aviation reports instantly.",
      "meta.title.aerodromo": "Find ICAO Code and Aerodromes | DecMET",
      "meta.description.aerodromo": "Find the ICAO code for any airport or aerodrome. Check name, city, country, IATA and coordinates for your METAR queries.",
      "meta.title.metar": "Real-Time METAR Lookup with NOAA Data | DecMET",
      "meta.description.metar": "Get the latest METAR by ICAO code directly from NOAA. View the raw report and copy for decoding.",
      "meta.title.about": "What is METAR? Complete Interpretation Guide | DecMET",
      "meta.description.about": "Learn how to interpret METAR: wind, visibility, phenomena, clouds, temperature and pressure. Practical examples and knowledge tree.",
      "metar.dynamic.title": "METAR {{icao}} - {{stationName}} | Real-Time Decoded",
      "metar.dynamic.description": "Check the latest METAR for {{icao}} ({{stationName}}): wind {{wind}}, visibility {{visibility}}, temperature {{temp}}.",
      "airport.dynamic.title": "Aerodrome {{icao}} - {{name}} | ICAO Code and Information",
      "airport.dynamic.description": "Complete information for {{name}} ({{icao}}): location, coordinates, elevation and operation type.",
      "home.tools.title": "Aviation tool for METAR, ICAO and aeronautical weather",
      
      "home.tools.decoding.title": "Decode METAR",
      "home.tools.decoding.body": "DecMET interprets wind, visibility, present weather, clouds, temperature, dew point and pressure groups, helping pilots, students and enthusiasts understand the raw report.",
      "home.tools.icao.title": "Search ICAO",
      "home.tools.icao.body": "The aerodrome search makes it easy to find the correct ICAO code before the METAR query, reducing station or airport identification errors.",
      "home.tools.metar.title": "METAR Lookup",
      "home.tools.metar.body": "Real-time query centralizes the raw METAR returned by the NOAA API and prepares the message for manual reading or decoding within the system.",

      "about.practice.title": "How to interpret a METAR in practice",
      "about.practice.readByGroups.title": "Read by groups, not by isolated words",
      "about.practice.readByGroups.body": "A METAR is organized into standardized blocks. First identify the ICAO station, then date and time, wind, visibility, weather phenomena, clouds, temperature, dew point and pressure.",
      "about.practice.observe.title": "Observe elements that affect operations",
      "about.practice.observe.body": "Strong or gusty wind, reduced visibility, fog, thunderstorm, low ceiling and pressure changes are important signs for aeronautical weather reading.",
      "about.practice.useDecMET.title": "Use DecMET as a study support",
      "about.practice.useDecMET.body": "After understanding the structure, use the METAR lookup to get a recent report and the decoder to compare the raw code with the plain language interpretation. For real operations, always confirm information with official sources.",

      "airports.howto.title": "How to find ICAO code for aerodromes",
      "airports.howto.search.title": "Search by name, city, ICAO or IATA",
      "airports.howto.search.body": "The search accepts different terms to locate airports, heliports and aerodromes. The four-letter ICAO code is the identifier used for METAR queries.",
      "airports.howto.confirm.title": "Confirm the aerodrome before the query",
      "airports.howto.confirm.body": "Many aerodromes have similar names or regional codes. Check location, country, IATA and coordinates before using the ICAO in the METAR query.",

      "metar.howto.title": "Real-time METAR lookup with NOAA data",
      "metar.howto.icao.title": "Enter the correct ICAO",
      "metar.howto.icao.body": "The METAR query depends on the four-letter ICAO code of the station. Use the aerodrome page to confirm the identifier before searching for the report.",
      "metar.howto.read.title": "Read the raw METAR",
      "metar.howto.read.body": "The response preserves the original weather message, allowing you to copy the METAR for analysis, training or decoding within DecMET.",
      "metar.howto.source.title": "Understand the data source",
      "metar.howto.source.body": "DecMET queries NOAA AviationWeather data and applies response handling and caching, avoiding exposing external integrations directly in the browser.",

      "decoder.howto.title": "How to decode METAR online with DecMET",
      "decoder.howto.step1.title": "1. Paste the raw report",
      "decoder.howto.step1.body": "Enter the METAR exactly as received, including the report type, ICAO code, UTC time and weather groups.",
      "decoder.howto.step2.title": "2. Review each group",
      "decoder.howto.step2.body": "The tool identifies wind, visibility, runway visual range, clouds, temperature, dew point, QNH and trends.",
      "decoder.howto.step3.title": "3. Compare with the operation",
      "decoder.howto.step3.body": "Use the METAR translation for quick reading, training and checking, always keeping final validation with official sources."
    }
  };

  // ========== FUNÇÕES BÁSICAS ==========
  function normalizeLanguage(lang) {
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  }

  function getCurrentLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE);
    } catch (error) {
      return DEFAULT_LANGUAGE;
    }
  }

  function t(key) {
    const language = getCurrentLanguage();
    return translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE]?.[key] ?? key;
  }

  function setLanguage(lang) {
    const language = normalizeLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn("Could not persist DecMET language:", error);
    }
    translatePage();
    window.dispatchEvent(new CustomEvent("decmet:languagechange", { detail: { language } }));
  }

  // ========== FUNÇÕES DE UI (LANGUAGE SWITCHER) ==========
  function syncLanguageControls(root = document) {
    const language = getCurrentLanguage();
    root.querySelectorAll("[data-language-switcher]").forEach((switcher) => {
      switcher.setAttribute("aria-label", t("common.language.label"));
    });
    root.querySelectorAll("[data-language-option]").forEach((button) => {
      const isActive = button.dataset.languageOption === language;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function ensureLanguageSwitcher() {
    if (document.querySelector("[data-language-switcher]")) return;
    const container = document.createElement("div");
    container.className = "language-switcher";
    container.dataset.languageSwitcher = "";
    container.setAttribute("aria-label", t("common.language.label"));
    container.innerHTML = `
      <button type="button" data-language-option="pt-BR">${t("common.language.pt")}</button>
      <button type="button" data-language-option="en-US">${t("common.language.en")}</button>
    `;
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language-option]");
      if (button) setLanguage(button.dataset.languageOption);
    });
    document.body.prepend(container);
  }

  // ========== FUNÇÕES DE TRADUÇÃO DA PÁGINA (COM PROTEÇÃO SEO) ==========
  window._dynamicTitleActive = false;
  window._dynamicDescriptionActive = false;

  function translatePage(root = document) {
    const language = getCurrentLanguage();
    document.documentElement.lang = language;

    root.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.setAttribute("title", t(el.dataset.i18nTitle));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
    root.querySelectorAll("[data-i18n-value]").forEach(el => {
      el.value = t(el.dataset.i18nValue);
    });

    // Título da página (somente se não estiver em modo dinâmico)
    const titleKey = document.documentElement.dataset.i18nTitle;
    if (titleKey && !window._dynamicTitleActive) {
      document.title = t(titleKey);
    }

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    const descKey = metaDesc?.getAttribute('data-i18n-description');
    if (descKey && !window._dynamicDescriptionActive && metaDesc) {
      metaDesc.content = t(descKey);
    }

    // Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.dataset.i18nOgTitle && !window._dynamicTitleActive) {
      ogTitle.content = t(ogTitle.dataset.i18nOgTitle);
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDesc.dataset.i18nOgDescription && !window._dynamicDescriptionActive) {
      ogDesc.content = t(ogDesc.dataset.i18nOgDescription);
    }

    syncLanguageControls(root);
  }

  // ========== NOVAS FUNÇÕES SEO ==========
  function setDynamicTitleAndDescription(titleKey, descriptionKey, variables = {}) {
    let rawTitle = t(titleKey);
    let rawDesc = t(descriptionKey);
    Object.keys(variables).forEach(key => {
      rawTitle = rawTitle.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
      rawDesc = rawDesc.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
    });
    document.title = rawTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = rawDesc;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = rawTitle;
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = rawDesc;
    window._dynamicTitleActive = true;
    window._dynamicDescriptionActive = true;
  }

  function resetToStaticMeta() {
    window._dynamicTitleActive = false;
    window._dynamicDescriptionActive = false;
    translatePage(); // reaplica as meta tags estáticas do HTML
  }

  // ========== EXPOSIÇÃO GLOBAL ==========
  window.DecMETI18n = {
    ...(window.DecMETI18n || {}),
    t,
    setLanguage,
    getCurrentLanguage,
    translatePage,
    setDynamicTitleAndDescription,
    resetToStaticMeta
  };

  // ========== INICIALIZAÇÃO ==========
  document.addEventListener("DOMContentLoaded", () => {
    ensureLanguageSwitcher();
    translatePage();
  });
})();
