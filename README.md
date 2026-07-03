DecMET — Sistema de Consulta e Decodificação de METAR

O DecMET é um sistema web voltado para consulta e interpretação de mensagens METAR, desenvolvido para estudantes e entusiastas da área de aviação.

A plataforma permite a consulta de condições meteorológicas de aeródromos em tempo real, utilizando dados meteorológicos provenientes da API da REDEMET (Rede de Meteorologia do Comando da Aeronáutica) e NOAA (National Oceanic and Atmospheric Administration).

Funcionalidade principal:

O diferencial do sistema está na transformação de METAR bruto em informações legíveis, permitindo uma leitura mais rápida e intuitiva das condições meteorológicas de um aeródromo. Mas não somente isto, mas na obtenção do código ICAO de milhares de aeródromos e consulta do METAR mais recente, via ICAO, dentro do próprio Sistema.

Infraestrutura:

• Front-end: HTML, Vanilla JavaScript e Tailwind CSS;
• Backend: Node.js + Express;
• Banco de dados: MySQL (Aiven DBaaS);
• API das Fontes Primárias: REDEMET e NOAA;
• Hospedagem: Render (com domínio personalizado).

Consoante ao acesso, o sistema está disponível em ambiente de produção via domínio personalizado, conforme indicado na seção About do repositório.
