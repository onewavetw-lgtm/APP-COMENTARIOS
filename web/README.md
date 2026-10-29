# LowWave Web — Vercel

Versão independente em Next.js, na pasta `web/`. O app Windows continua na raiz;
este projeto não importa, altera ou instala dependências no aplicativo local.

## Arquitetura

- Página React com o tema escuro/ciano do LowWave.
- Cada POST `/api/youtube` faz **uma única chamada** a um endpoint fixo da API oficial.
- Timeout upstream de 18 segundos; função configurada com duração máxima de 30s.
- Paginação e pausas por 429 acontecem no navegador, sem função dormindo por minutos.
- O navegador coordena a pesquisa e grava cada página bem-sucedida em IndexedDB.
- Busca intercalada entre termos, seleção por relevância/visualizações e links prioritários.
- Arquivo `lowwave-analise.json` mantém `formato`, `instrucoes`, `total_registros` e
  `comentarios`, compatíveis com o plugin. Um campo adicional `coleta` informa parcial/
  concluída, vídeos previstos/finalizados e avisos. Não existe classificação por IA no app.
- CSV completo e TXT filtrado também podem ser baixados.

A chave é fornecida pelo visitante, usada na memória da página e enviada no corpo do
POST ao servidor. Não é gravada no IndexedDB, nos arquivos exportados ou no código.
Não configurar uma chave compartilhada `NEXT_PUBLIC_*`. A rota não imprime parâmetros,
corpos de erros do Google ou credenciais. As respostas usam `Cache-Control: no-store`.
O hostname upstream é fixo e os parâmetros são validados; não há proxy de URLs arbitrárias.

## Desenvolvimento

Node.js 24 e npm. Na pasta `web/`:

```sh
npm ci
npm run dev
```

Validação:

```sh
npm run test
npm run typecheck
npm run build
npm run start
```

As dependências estão fixadas no package-lock.json. `analysis-template.json` reaproveita
as instruções do exportador Python. Testes usam respostas simuladas, não a cota real.

## Publicar na Vercel

1. Importar `onewavetw-lgtm/APP-COMENTARIOS` pelo GitHub na conta do usuário.
2. Escolher **Root Directory: web** (obrigatório) e framework **Next.js**.
3. Usar Node.js 24; instalação `npm ci`, build `npm run build`. Manter os demais padrões.
4. Não é necessário fornecer chave YouTube como variável de ambiente: ela é digitada
   pelo visitante. Não há banco de dados no servidor, serviço pago de IA ou worker externo nesta versão.
5. Publicar e testar uma coleta pequena usando uma chave real. Conferir os logs,
   duração das funções, consumo de recursos e limites/condições do plano escolhido.
6. Usar o endereço confirmado pela Vercel; nenhum endereço público foi gerado localmente.

O projeto foi desenhado para chamadas curtas, mas isso não comprova adequação a todo
volume ou ao plano gratuito. Limites e termos atuais da Vercel devem ser conferidos
antes de uso contínuo. Hospedar não remove a cota nem os bloqueios do YouTube.

## Progresso e privacidade

O progresso pertence a este navegador/dispositivo e inclui comentários públicos e seus
metadados. Não há sincronização, conta de usuário ou armazenamento de pesquisas no
servidor. Use uma única aba para a coleta; exporte antes de iniciar outra pesquisa,
limpar dados do navegador ou usar navegação privada. O botão Limpar remove o checkpoint.
Uma pesquisa nova pede confirmação antes de substituir o checkpoint anterior.

Recarregar ou fechar a página interrompe a coordenação. Após abrir de novo, informe
a chave e clique **Continuar coleta**. Nenhuma requisição começa automaticamente.
Se uma página não foi confirmada/salva, pode ser consultada novamente na retomada.
Se a gravação local falhar, o app avisa; exporte os registros disponíveis.

Um erro 429 faz até três novas tentativas no navegador, respeitando Retry-After de até
60s. Esperas maiores ou limite persistente pausam e exibem cooldown; erros de cota
não são retentados automaticamente. O checkpoint permanece disponível para exportação.
Não há garantia de disponibilidade da API. Resultados da busca podem diferir da
página personalizada do YouTube; idioma é preferência e Shorts não têm filtro próprio.

## Validação atual

- 17 testes automatizados de API, fluxo, filtros/exportação, links e retomada por cursor.
- Verificação TypeScript e build de produção.
- Navegador com API simulada: coleta completa, download real do JSON, persistência
  após recarga sem guardar a chave e tela mobile sem rolagem horizontal indevida.
- Endpoint de produção rejeitando operação inválida sem expor credenciais.
- Coleta real e execução na Vercel ainda dependem de configuração da conta e chave válida.


## Navegação, prompt e filtros

O menu leva às seções da página, inclusive antes de haver resultados. Os atalhos
Palavras de dor e Prompt para o ChatGPT abrem os respectivos painéis. Eles também
estão disponíveis no celular.

A orientação editável é salva na pesquisa e exportada no campo
`orientacao_da_pesquisa` do JSON. No TXT, a inclusão do prompt é opcional.
`{assunto}` é substituído pelos temas da pesquisa. Checkpoints anteriores sem esses
campos continuam compatíveis e usam o prompt padrão.

Depois da coleta, edite filtros ou prompt e clique em **Aplicar aos comentários
salvos** ou **Aplicar prompt à pesquisa salva**. Isso atualiza a prévia, a seleção
do TXT e as marcações no JSON/CSV sem chamar o YouTube. JSON e CSV preservam todos
os registros baixados, mesmo os excluídos do TXT. Recarregar restaura as configurações
da pesquisa; a chave continua fora do armazenamento.

Verificado no navegador com API simulada: cinco atalhos, navegação mobile, prompt
editado no JSON/TXT, reaplicação de filtros sem solicitações adicionais e restauração.


## Biblioteca local

`/biblioteca` guarda pesquisas no IndexedDB `lowwave-library`, independente do
checkpoint atual (`lowwave-web`). Novas páginas de comentários são arquivadas
sem requisições adicionais ao YouTube. O checkpoint anterior à atualização é
migrado uma vez. Limpar o checkpoint não exclui pesquisas arquivadas.

- Importa `lowwave-analise-v1` até 25 MB, com prévia e nome. Confere a lista inteira
  de registros; totais declarados não substituem a contagem real.
- Uma impressão SHA-256 do JSON canônico identifica arquivos iguais, inclusive
  com diferenças de espaços/ordem das chaves. Não deduplica relatos por texto.
- Fonte original preservada separadamente de nome/status, anotações, favoritos e
  relatório externo. Download original não incorpora interpretações.
- Nomes públicos dos autores são exibidos quando presentes; não há inferência de gênero.
- Comentários paginados em 50 registros, busca por autor/texto/vídeo, metadados e
  fontes do YouTube. Conteúdo importado nunca é executado ou renderizado como HTML.
- Linguagem: sequências literais normalizadas de 2 a 4 palavras, contadas uma vez
  por registro, número de vídeos identificados e exemplos; não classifica dores.
- Relatórios TXT/MD podem ser importados como texto (até 2 MB).
- Backup `lowwave-biblioteca-v1` inclui fonte, notas e relatórios. Restauração
  valida todas as pesquisas e integridade das fontes antes de gravar; IDs existentes
  são preservados, sem substituir notas. Nenhuma chave de API é incluída.

Não há conta/sincronização ou persistência no servidor. Limpeza do navegador e
modo privado podem eliminar a biblioteca. Faça backup e restaure no outro aparelho.
Importação, consulta, expressões, anotações e backup não usam a API do YouTube.


Validação da biblioteca: 14 testes Node aprovados e build/TypeScript aprovados.
Navegador de produção com dados fictícios: importação, arquivo repetido, nomes,
anotações/favoritos, fonte original intacta, contagem literal por registro/vídeo,
recarga, backup restaurado em contexto vazio, mobile e ausência de chamadas ao
YouTube. Coleta com API simulada confirma arquivamento automático e preservação
da exclusão de pesquisa sem recriar o checkpoint ao abrir a biblioteca.


## Barra de cota estimada

O menu da coleta acompanha as tentativas feitas a `/api/youtube` neste navegador.
Custos adotados para estimativa: search.list 100, videos.list 1 e commentThreads.list
1 por chamada/página, incluindo repetições. Não consulta métricas do Cloud e não
representa o saldo real do projeto. Falhas/cancelamentos podem ser contados mesmo
sem alcançar o Google; consumo anterior, Windows, outros aparelhos e outras
chaves do mesmo projeto não são descobertos pelo contador.

Referência inicial editável de 10.000 unidades, com ajuste manual opcional para o
consumo total conferido no Google Cloud. Um ajuste substitui o total estimado naquele
momento e as próximas tentativas se somam a ele. Avisos visuais em 75%/90%; não
bloqueia a coleta. A contagem diária segue America/Los_Angeles, inclusive horário de
verão. Referência persiste; consumo e ajuste começam novamente no dia seguinte.

IndexedDB `lowwave-quota` usa SHA-256 da chave como identificador, sem armazenar a
credencial. Atualizações usam transações para evitar perda de contagens entre abas.
O contador não integra exportações de pesquisa nem backup da biblioteca. Limpar os
dados do navegador remove seu histórico. A tela atualiza ao trocar a chave, nas
tentativas e a cada minuto. Indisponibilidade de armazenamento é sinalizada.

Verificações: 17 testes Node, TypeScript/build e navegador com API simulada. O fluxo
search/videos/comments soma 102 unidades; ajuste para 90%, troca de chave e recarga
funcionam, sem credenciais no contador ou consultas extras para monitoramento.
