// Translation utility for METAR decoded parts
// This module translates METAR decoder output from Portuguese to English

export function translateMetarPart(part, language) {
  if (language === 'pt-BR') {
    return part;
  }

  if (language !== 'en-US') {
    return part;
  }

  const translations = {
    // Types/Categories
    'Modificador': 'Modifier',
    'Correção': 'Correction',
    'Relatório indisponível': 'Report unavailable',
    'Tipo de relatório': 'Report type',
    'Identificador da estação': 'Station identifier',
    'Data e hora do reporte': 'Report date and time',
    'Vento': 'Wind',
    'Variação da direção do vento': 'Wind direction variation',
    'Windshear': 'Windshear',
    'CAVOK': 'CAVOK',
    'Visibilidade direcional': 'Directional visibility',
    'Visibilidade': 'Visibility',
    'Visibilidade em milhas estatutárias': 'Visibility in statute miles',
    'Alcance visual de pista': 'Runway visual range',
    'Nuvens': 'Clouds',
    'Condição do céu': 'Sky condition',
    'Visibilidade vertical': 'Vertical visibility',
    'Possível erro de codificação': 'Possible coding error',
    'Temperatura / Ponto de orvalho': 'Temperature / Dew point',
    'Pressão atmosférica': 'Atmospheric pressure',
    'Altímetro / pressão atmosférica': 'Altimeter / atmospheric pressure',
    'Tempo presente': 'Present weather',
    'Tendência': 'Trend',
    'Tendência temporária': 'Temporary trend',
    'Tendência de mudança gradual': 'Gradual change trend',
    'Tendência - sem tempo significativo': 'Trend - no significant weather',
    'Probabilidade de tendência': 'Trend probability',
    'Tendência - a partir de': 'Trend - from',
    'Tendência - até': 'Trend - until',
    'Tendência - horário': 'Trend - time',
    'Observação - estação automática': 'Observation - automatic station',
    'Observação - pressão ao nível do mar': 'Observation - sea level pressure',
    'Observação - temperatura precisa': 'Observation - precise temperature',
    'Observação - precipitação horária': 'Observation - hourly precipitation',
    'Observação - precipitação 3/6h': 'Observation - 3/6h precipitation',
    'Observação - precipitação 24h': 'Observation - 24h precipitation',
    'Observação - tendência da pressão': 'Observation - pressure tendency',
    'Observação - manutenção': 'Observation - maintenance',
    'Observação - início/fim de fenômeno': 'Observation - phenomenon start/end',
    'Observação complementar': 'Complementary observation',
    'Não identificado': 'Not identified',
    'Início das observações': 'Remarks start'
  };

  // Translate main type/category
  if (translations[part.type]) {
    part.type = translations[part.type];
  }

  // Translate descriptions containing common patterns
  part.description = translateDescription(part.description, language);

  return part;
}

function translateDescription(desc, language) {
  const descriptionTranslations = {
    'Relatório gerado automaticamente por uma estação meteorológica.': 'Report generated automatically by a weather station.',
    'Relatório corrigido.': 'Corrected report.',
    'METAR não disponível para esta estação no momento informado.': 'METAR not available for this station at the reported time.',
    'A partir deste ponto, o METAR apresenta observações complementares. Esses grupos podem variar bastante conforme o país e o órgão meteorológico.': 'From this point, the METAR presents complementary observations. These groups may vary widely depending on the country and meteorological agency.',
    'Relatório meteorológico regular de aeródromo.': 'Regular aerodrome meteorological report.',
    'Relatório meteorológico especial, emitido fora do horário regular.': 'Special meteorological report, issued outside regular hours.',
    'Vento calmo.': 'Calm wind.',
    'Variação da direção do vento': 'Wind direction varying',
    'Windshear reportado em todas as pistas.': 'Windshear reported on all runways.',
    'Windshear reportado na pista': 'Windshear reported on runway',
    'Condição meteorológica favorável: visibilidade igual ou superior a 10 km, sem nuvens significativas e sem tempo significativo.': 'Favorable weather condition: visibility equal to or greater than 10 km, no significant clouds and no significant weather.',
    'Visibilidade não informada ou indisponível.': 'Visibility not reported or unavailable.',
    'Visibilidade horizontal de 10 km ou mais.': 'Horizontal visibility of 10 km or more.',
    'NDV indica ausência de variação direcional reportada.': 'NDV indicates no directional variation reported.',
    'Céu claro, sem nuvens reportadas.': 'Clear sky, no clouds reported.',
    'Céu claro abaixo do limite de detecção da estação automática.': 'Clear sky below the detection limit of the automated station.',
    'Sem nuvens significativas.': 'No significant clouds.',
    'Nenhuma nuvem detectada por estação automática.': 'No clouds detected by automated station.',
    'Visibilidade vertical não informada.': 'Vertical visibility not reported.',
    'Esta parte ainda não foi reconhecida pelo decodificador.': 'This part has not yet been recognized by the decoder.',
    'Estação automática sem discriminador de precipitação.': 'Automated station without precipitation discriminator.',
    'Estação automática com discriminador de precipitação.': 'Automated station with precipitation discriminator.',
    'Pressão atmosférica caindo rapidamente.': 'Atmospheric pressure falling rapidly.',
    'Pressão atmosférica subindo rapidamente.': 'Atmospheric pressure rising rapidly.',
    'Indicador de necessidade de manutenção na estação automática.': 'Indicator of need for maintenance on automated station.',
    'Grupo de observação indicando início e/ou fim de fenômeno meteorológico no período recente.': 'Observation group indicating start and/or end of meteorological phenomenon in recent period.',
    'Grupo de observação complementar. Pode possuir significado regional ou operacional específico.': 'Complementary observation group. May have regional or specific operational meaning.',
    'Sem mudança significativa prevista.': 'No significant change expected.',
    'Indica condições temporárias previstas no período de tendência.': 'Indicates temporary conditions expected during the trend period.',
    'Indica mudança gradual prevista nas condições meteorológicas.': 'Indicates gradual change expected in meteorological conditions.',
    'Indica ausência de tempo significativo previsto.': 'Indicates no significant weather expected.',
    'Poucas nuvens (1 a 2 oitavos do céu)': 'Few clouds (1 to 2 eighths of sky)',
    'Nuvens esparsas (3 a 4 oitavos do céu)': 'Scattered clouds (3 to 4 eighths of sky)',
    'Céu muito nublado (5 a 7 oitavos do céu)': 'Very cloudy (5 to 7 eighths of sky)',
    'Céu encoberto (8 oitavos do céu)': 'Overcast (8 eighths of sky)',
    'com altura não informada.': 'with unreported height.',
    ' pés.': ' feet.',
    'Presença de Cumulonimbus.': 'Presence of Cumulonimbus.',
    'Presença de Towering Cumulus (Cumulus Congestus).': 'Presence of Towering Cumulus (Cumulus Congestus).',
    'nós': 'knots',
    'metros por segundo': 'meters per second',
    'quilômetros por hora': 'kilometers per hour',
    'norte': 'north',
    'nordeste': 'northeast',
    'leste': 'east',
    'sudeste': 'southeast',
    'sul': 'south',
    'sudoeste': 'southwest',
    'oeste': 'west',
    'noroeste': 'northwest',
    'direção variável': 'variable direction',
    'Rajadas de até': 'Gusts up to',
    'Reporte emitido no dia': 'Report issued on day',
    'às': 'at',
    'UTC': 'UTC',
    'Código ICAO da estação meteorológica ou aeródromo:': 'ICAO code of the weather station or aerodrome:',
    'com velocidade de': 'with speed of',
    'direção': 'direction',
    'metros na direção': 'meters toward the',
    'metros.': 'meters.',
    'milha(s) estatutária(s), aproximadamente': 'statute mile(s), approximately',
    'km.': 'km.',
    'Alcance visual da pista': 'Runway visual range',
    'variando até': 'varying up to',
    'Tendência:': 'Tendency:',
    'aumentando': 'increasing',
    'diminuindo': 'decreasing',
    'sem mudança significativa': 'no significant change',
    'pés': 'feet',
    'hPa': 'hPa',
    'QNH de': 'QNH of',
    'Ajuste altimétrico de': 'Altimeter setting of',
    'inHg, aproximadamente': 'inHg, approximately',
    'Temperatura de': 'Temperature of',
    'e ponto de orvalho de': 'and dew point of',
    'não informada': 'not reported',
    '°C': '°C',
    'não informado': 'not reported',
    'Probabilidade de': 'Probability of',
    'para as condições previstas na tendência.': 'for the conditions expected in the trend.',
    'Condição prevista a partir do dia': 'Condition expected from day',
    'Condição prevista até': 'Condition expected until',
    'Condição prevista em torno de': 'Condition expected around',
    'polegada(s)': 'inch(es)',
    'intensidade fraca': 'weak intensity',
    'intensidade forte': 'strong intensity',
    'nas proximidades do aeródromo': 'in the vicinity of the aerodrome',
    'fenômeno recente': 'recent phenomenon',
    'baixo': 'low',
    'parcial': 'partial',
    'bancos': 'banks',
    'levantado baixo pelo vento': 'lifted low by wind',
    'soprado pelo vento': 'blown by wind',
    'pancadas': 'showers',
    'trovoada': 'thunderstorm',
    'congelante': 'freezing',
    'garoa': 'drizzle',
    'chuva': 'rain',
    'neve': 'snow',
    'grãos de neve': 'snow grains',
    'cristais de gelo': 'ice crystals',
    'pelotas de gelo': 'ice pellets',
    'granizo': 'hail',
    'granizo pequeno ou neve granulada': 'small hail or granular snow',
    'precipitação desconhecida': 'unknown precipitation',
    'névoa úmida': 'mist',
    'nevoeiro': 'fog',
    'fumaça': 'smoke',
    'cinzas vulcânicas': 'volcanic ash',
    'poeira espalhada': 'widespread dust',
    'areia': 'sand',
    'névoa seca': 'haze',
    'spray': 'spray',
    'redemoinhos de poeira ou areia': 'dust/sand whirls',
    'linha de instabilidade': 'instability line',
    'funil, tornado ou tromba d\'água': 'funnel, tornado or waterspout',
    'tempestade de areia': 'sandstorm',
    'tempestade de poeira': 'duststorm'
  };

  let translatedDesc = desc;

  // Try exact match first
  if (descriptionTranslations[desc]) {
    return descriptionTranslations[desc];
  }

  // Try pattern replacements
  for (const [pt, en] of Object.entries(descriptionTranslations)) {
    if (translatedDesc.includes(pt)) {
      translatedDesc = translatedDesc.replace(pt, en);
    }
  }

  return translatedDesc;
}
