# DecMeT - Configuração do Banco de Dados de Aeródromos

Este diretório contém os scripts necessários para inicializar e popular o banco de dados MySQL de aeródromos e aeroportos usado no projeto DecMeT. A base de dados é construída a partir do dataset público fornecido pelo **OurAirports**.

> [!WARNING]  
> **ALERTA DE SEGURANÇA E OPERAÇÃO AERONÁUTICA**  
> Os dados do OurAirports são úteis para fins educacionais, testes locais e referência rápida de códigos no DecMeT. Contudo, **NÃO devem ser tratados como fonte de dados aeronáuticos oficiais** para planejamento real de voos, navegação aérea ou qualquer aplicação crítica de segurança. Sempre consulte os canais oficiais de informação aeronáutica (como AISWEB / DECEA).

---

## 1. Arquitetura de Acesso e Segurança

O DecMeT segue um modelo de arquitetura em camadas para garantir a segurança dos dados e credenciais:

```
+------------------+         HTTP/JSON         +-------------------+
|  Browser / Client| <=======================> |  DecMET Backend   |
| (aerodromo.html)|                           |  (Node/Python/Go) |
+------------------+                           +-------------------+
                                                         ||
                                                         || SQL Connection
                                                         \/
                                               +-------------------+
                                               |   MySQL Database  |
                                               | (decmet_airports) |
                                               +-------------------+
```

- **Acesso Seguro (Correto)**: O navegador envia requisições HTTP para um endpoint da API backend (`GET /api/aeroportos?search=<query>`), que realiza a query no banco de dados e retorna uma resposta JSON limpa.
- **Acesso Inseguro (Proibido)**: **Nunca conecte o JavaScript front-end diretamente ao banco MySQL**. Credenciais de acesso (host, usuário, senha, porta) jamais devem constar em arquivos públicos HTML, CSS ou JavaScript.

---

## 2. Estrutura do Banco de Dados

O banco de dados é composto por 3 tabelas principais:
1. `countries`: Cadastro de países.
2. `regions`: Cadastro de regiões/estados.
3. `airports`: Cadastro de aeródromos, heliportos, hidro bases e aeroportos.

Os scripts SQL estruturados estão localizados em:
- [schema.sql](./schema.sql): Criação da base `decmet_airports` e suas tabelas com chaves estrangeiras, índices de performance e um índice `FULLTEXT` na tabela de aeroportos.

---

## 3. Instruções de Importação (OurAirports CSV)

Para rodar a importação de dados, você precisará baixar os seguintes arquivos CSV do OurAirports:
- [airports.csv](https://davidmegginson.github.io/ourairports-data/airports.csv)
- [regions.csv](https://davidmegginson.github.io/ourairports-data/regions.csv)
- [countries.csv](https://davidmegginson.github.io/ourairports-data/countries.csv)

### Método A: Utilizando `LOAD DATA LOCAL INFILE`
Você pode rodar o arquivo [import_ourairports.sql](./import_ourairports.sql). Devido a restrições de segurança padrão do MySQL, pode ser necessário habilitar o recurso de arquivos locais:

1. No terminal do MySQL, execute:
   ```sql
   SET GLOBAL local_infile = 1;
   ```
2. Ao conectar no cliente MySQL via terminal, use a flag `--local-infile`:
   ```bash
   mysql --local-infile=1 -u seu_usuario -p < import_ourairports.sql
   ```

### Método B: Scripts Auxiliares de Importação (Recomendado para contornar restrições de INFILE)

Se você não puder habilitar o `LOCAL INFILE` no servidor, use um dos scripts abaixo para ler os arquivos CSV e inseri-los no MySQL via Driver.

#### Script em Python (utilizando `pandas` e `mysql-connector-python`):
```python
import pandas as pd
import mysql.connector

# Configuração de conexão
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="sua_senha",
    database="decmet_airports"
)
cursor = conn.cursor()

# Desativa FKs temporariamente
cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
cursor.execute("TRUNCATE TABLE airports;")
cursor.execute("TRUNCATE TABLE regions;")
cursor.execute("TRUNCATE TABLE countries;")
cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

# Importa Countries
df_countries = pd.read_csv("countries.csv").where(pd.notnull, None)
for idx, row in df_countries.iterrows():
    cursor.execute(
        "INSERT INTO countries (id, code, name, continent, wikipedia_link, keywords) VALUES (%s,%s,%s,%s,%s,%s)",
        (row['id'], row['code'], row['name'], row['continent'], row['wikipedia_link'], row['keywords'])
    )

# Importa Regions
df_regions = pd.read_csv("regions.csv").where(pd.notnull, None)
for idx, row in df_regions.iterrows():
    cursor.execute(
        "INSERT INTO regions (id, code, local_code, name, continent, iso_country, wikipedia_link, keywords) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (row['id'], row['code'], row['local_code'], row['name'], row['continent'], row['iso_country'], row['wikipedia_link'], row['keywords'])
    )

# Importa Airports
df_airports = pd.read_csv("airports.csv").where(pd.notnull, None)
sql_airports = """
    INSERT INTO airports (
      id, ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent,
      iso_country, iso_region, municipality, scheduled_service, gps_code, icao_code,
      iata_code, local_code, home_link, wikipedia_link, keywords
    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""
for idx, row in df_airports.iterrows():
    cursor.execute(sql_airports, (
        row['id'], row['ident'], row['type'], row['name'], row['latitude_deg'], row['longitude_deg'],
        row['elevation_ft'], row['continent'], row['iso_country'], row['iso_region'], row['municipality'],
        row['scheduled_service'], row['gps_code'], row['icao_code'], row['iata_code'], row['local_code'],
        row['home_link'], row['wikipedia_link'], row['keywords']
    ))

conn.commit()
cursor.close()
conn.close()
print("Importação concluída com sucesso!")
```

#### Outros Métodos:
- **MySQL Workbench**: Botão direito nas tabelas -> *Table Data Import Wizard* -> Selecione os arquivos CSV e faça o mapeamento de colunas.
- **phpMyAdmin**: Acesse cada tabela -> Aba *Importar* -> Escolha o arquivo CSV correspondente, marque "Ignorar a primeira linha" e verifique o delimitador de campos `,`.

---

## 4. Exemplos de Consultas Úteis para Testes

Aqui estão consultas SQL padrão para testar o banco após a importação:

### Consulta A: Busca exata por código ICAO (Ex: SBGR)
```sql
SELECT 
  icao_code, 
  iata_code, 
  name, 
  municipality, 
  iso_region, 
  iso_country, 
  type 
FROM airports 
WHERE icao_code = 'SBGR';
```

### Consulta B: Busca textual ampla utilizando FULLTEXT index (Ex: "guarulhos")
```sql
SELECT 
  icao_code, 
  iata_code, 
  name, 
  municipality, 
  iso_region, 
  iso_country, 
  type 
FROM airports 
WHERE 
  MATCH(ident, name, municipality, gps_code, icao_code, iata_code, local_code, keywords) 
  AGAINST ('guarulhos' IN NATURAL LANGUAGE MODE)
LIMIT 20;
```

### Consulta C: Listagem ordenada de aeródromos no Brasil
```sql
SELECT 
  icao_code, 
  iata_code, 
  name, 
  municipality, 
  iso_region, 
  iso_country, 
  type 
FROM airports 
WHERE 
  iso_country = 'BR' 
  AND icao_code IS NOT NULL 
  AND icao_code <> '' 
ORDER BY name 
LIMIT 50;
```

---

## 5. Contrato da API Backend e Query de Junção

Quando o backend do DecMeT for desenvolvido, o endpoint deverá receber consultas textuais no formato:
`GET /api/aeroportos?search=<query>`

### Resposta JSON Esperada pelo Front-end
```json
[
  {
    "icao_code": "SBGR",
    "iata_code": "GRU",
    "name": "São Paulo/Guarulhos International Airport",
    "municipality": "Guarulhos",
    "region": "São Paulo",
    "country": "Brazil",
    "type": "large_airport",
    "latitude_deg": -23.435556,
    "longitude_deg": -46.473056,
    "elevation_ft": 2459
  }
]
```

### Query Recomendada para o Backend (Unindo Regiões e Países)
A query abaixo realiza joins com as tabelas de suporte para retornar o nome por extenso da Região e do País, priorizando correspondências exatas de chaves de identificação (ICAO, IATA, ident) e caindo para busca textual secundária:

```sql
SELECT 
  a.icao_code, 
  a.iata_code, 
  a.ident, 
  a.name, 
  a.municipality, 
  r.name AS region, 
  c.name AS country, 
  a.type, 
  a.latitude_deg, 
  a.longitude_deg, 
  a.elevation_ft
FROM airports a
LEFT JOIN regions r ON r.code = a.iso_region
LEFT JOIN countries c ON c.code = a.iso_country
WHERE 
  a.icao_code = ? 
  OR a.iata_code = ? 
  OR a.ident = ? 
  OR MATCH(
    a.ident, 
    a.name, 
    a.municipality, 
    a.gps_code, 
    a.icao_code, 
    a.iata_code, 
    a.local_code, 
    a.keywords
  ) AGAINST (? IN NATURAL LANGUAGE MODE)
LIMIT 25;
```

*Nota: Ao preparar os parâmetros de query no backend, recomenda-se passar o termo exato uppercase para as três primeiras condições e o termo limpo de busca para o `AGAINST` do FULLTEXT.*
