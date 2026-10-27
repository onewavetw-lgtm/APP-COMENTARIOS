# LowWave

Pesquisa de público por comentários do YouTube. Interface escura para buscar vídeos,
reunir relatos, consultar fontes e exportar material para análise no ChatGPT.
A descoberta de dores é feita no ChatGPT, não automaticamente pelo coletor.

## Site e atualizações

O ponto de entrada do site é **app.py**. O código pode ser hospedado no Streamlit
Community Cloud, conectado a este repositório. Depois da publicação, cada atualização
enviada à branch de implantação é aplicada pelo provedor: o usuário continua no mesmo
link, sem ZIP, instalação de Python ou terminal no computador.

### Publicar uma única vez

1. Acesse https://share.streamlit.io/ e entre com a conta que tem acesso a este
   repositório no GitHub. Autorize o Streamlit a ler o repositório, se solicitado.
2. Crie um app a partir de um repositório existente:
   - Repositório: `onewavetw-lgtm/APP-COMENTARIOS`
   - Branch: `main`
   - Arquivo principal: `app.py`
3. Nas configurações avançadas, selecione Python **3.12**. A instalação usa
   `requirements.txt`; o tema está em `.streamlit/config.toml`.
4. Escolha o endereço disponível e publique. Só o endereço confirmado pelo provedor
   é o link real do app; não presuma que um nome específico estará disponível.
5. Se quiser acesso só para você, configure a privacidade e os usuários permitidos
   nos controles do provedor antes de compartilhar o link.
6. Abra o site, informe sua chave do YouTube, teste uma coleta e baixe o resultado.

Não é necessário configurar chave do YouTube em Secrets: cada visitante usa sua
própria chave em sua sessão. O site não preenche campos com chaves do servidor nem
grava a chave digitada em arquivo. A conexão ao YouTube sai da hospedagem, não do
computador do usuário; uma restrição de chave por IP precisa considerar isso.
Resultados da sessão podem desaparecer ao fechar a sessão ou após uma atualização;
baixe os arquivos que quiser guardar. Hospedagens gratuitas podem suspender apps
inativos e precisam de tempo para iniciar novamente.

### Atualizar depois

1. Faça a mudança no repositório e execute os testes.
2. Envie a versão validada à branch `main`.
3. A hospedagem conectada recebe a atualização. Confira o resultado no link existente.

Esse fluxo depende da conexão e implantação inicial no provedor. Salvar ou testar
arquivos localmente não publica o site. Não inclua `.env`, chaves ou backups no Git.

## Desenvolvimento

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/python -m streamlit run app.py
```

O iniciador `coletor_de_comentarios.py` e os arquivos `.bat` são compatibilidade com
o modo Windows anterior. Para a nova hospedagem, use sempre **app.py**.
O guia do modo local está em [LEIA-ME.md](LEIA-ME.md).
