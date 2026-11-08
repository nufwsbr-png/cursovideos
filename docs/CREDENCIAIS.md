# Credenciais das plataformas (uma vez só, na sua máquina)

A fábrica só lê credenciais de **variáveis de ambiente**: no computador, pelo arquivo `.env` na raiz (que está no `.gitignore`);
no GitHub Actions, pelos *Secrets* do repositório. **Nunca** cole token em chat, em issue, no cérebro (`memoria/`) nem em commit.
Quem tem o token tem a sua conta.

Ajuda interativa: `node fabrica/publicar/conectar.js <youtube|tiktok|meta|kwai>` imprime as linhas prontas para colar no `.env`.
Teste sem gastar nada: `node fabrica/publicar/index.js --episodio episodios/ep01_x --simular` (mostra as requisições e o que falta).

> ⚠️ Os passos abaixo seguem os portais como eram conhecidos até 2025 e **não foram conferidos nesta sessão** (sites fora da rede permitida).
> Os nomes de botões mudam; os nomes das variáveis **não** mudam.

## Tabela das variáveis

| Variável | Rede | Como obter | Validade |
|---|---|---|---|
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok | developers.tiktok.com → *Manage apps* → criar app → produtos **Login Kit** e **Content Posting API** (marcar *Direct Post*) → escopos `user.info.basic`, `video.publish`, `video.upload`, `video.list` → cadastrar a *Redirect URI* | fixas |
| `TIKTOK_REFRESH_TOKEN` | TikTok | `conectar.js tiktok` (OAuth) | 365 dias; é trocado a cada renovação — quando a fábrica avisar "refresh token novo", atualize |
| `TIKTOK_ACCESS_TOKEN` (opcional) | TikTok | a fábrica renova sozinha com o refresh token | 24 h |
| `META_PAGE_ID` | Facebook | id da Página do canal (`conectar.js meta` lista) | fixa |
| `META_PAGE_ACCESS_TOKEN` | Facebook e Instagram | token de **Página** derivado de um token de usuário de longa duração (`conectar.js meta`), com `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `pages_read_user_content`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights` | não expira (cai se trocar a senha ou remover o app) |
| `IG_USER_ID` | Instagram | id da conta profissional do Instagram ligada à Página (`conectar.js meta` mostra) | fixa |
| `META_APP_ID`, `META_APP_SECRET` (só para o `conectar.js meta`) | Meta | developers.facebook.com → app tipo *Business* | fixas |
| `META_GRAPH_VERSION` (opcional) | Meta | versão da Graph API; padrão `v21.0` | — |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | YouTube | console.cloud.google.com → ativar **YouTube Data API v3** (e *YouTube Analytics API* se quiser tempo médio) → *Credenciais* → *ID do cliente OAuth* tipo **Aplicativo da Web** com redirect `http://localhost:8765/callback` → tela de consentimento com os escopos `youtube.upload`, `youtube.force-ssl`, `yt-analytics.readonly` | fixas |
| `YOUTUBE_REFRESH_TOKEN` | YouTube | `conectar.js youtube` | enquanto o app OAuth estiver em *Testing*, **7 dias**; publique o app (*Production*) para durar |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | hospedagem (Instagram exige URL pública) | supabase.com → projeto → *Settings → API*: URL do projeto e chave `service_role` (segredo!). A fábrica cria o bucket público `videos` sozinha | fixas |
| `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | hospedagem alternativa (`github_release`) | no GitHub Actions já existem; local: token clássico com `repo` | token local: conforme criado |
| `HOSPEDAGEM_PROVEDOR` (opcional) | hospedagem | `supabase` (padrão), `github_release` ou `url_fixa` (+ `HOSPEDAGEM_URL_BASE`) | — |
| `KWAI_MODO` | Kwai | `fila_manual` (padrão seguro) ou `navegador` (só na sua máquina, depois de `conectar.js kwai`) | — |

## TikTok, passo a passo

1. Crie o app em developers.tiktok.com com a conta do canal. Adicione **Login Kit** e **Content Posting API**; em *Content Posting*, habilite **Direct Post**.
2. Cadastre a *Redirect URI*. O TikTok costuma exigir **HTTPS**; se `http://localhost:8765/callback` for recusado, use uma URL sua (pode ser uma página estática) e cole no terminal a URL de retorno inteira: o `conectar.js` extrai o `code`.
3. Rode `node fabrica/publicar/conectar.js tiktok`, autorize com a conta do canal e cole as três linhas no `.env`.
4. **Auditoria**: enquanto o app não for aprovado na revisão do TikTok, o `creator_info` só devolve `SELF_ONLY` e os vídeos saem **privados**. A fábrica avisa e segue; depois da aprovação, nada muda no código.
5. A etiqueta de conteúdo de IA vai no campo `is_aigc` (cap. 12 e 72). Confira no app se o rótulo apareceu no primeiro vídeo.

## Meta (Instagram e Facebook), passo a passo

1. A conta do Instagram precisa ser **profissional** e estar ligada a uma **Página** do Facebook da qual você é administrador.
2. Em developers.facebook.com crie um app do tipo *Business*; adicione *Facebook Login for Business* e *Instagram Graph API*.
3. No *Graph API Explorer*, gere um token de usuário com as permissões da tabela. Rode `node fabrica/publicar/conectar.js meta`: ele troca por um token de longa duração, lista as Páginas e imprime `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` e `IG_USER_ID`.
4. Para o app sair do modo de desenvolvimento (publicar em contas que não são de testadores) é preciso **App Review** das permissões acima.
5. **Reels do Instagram só aceitam URL pública**: configure `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` (ou `github_release`). O arquivo é apagado da hospedagem depois da publicação.
6. Reels do Facebook pela API aceitam **até 90 s**; episódios mais longos entram como vídeo comum da Página (a fábrica decide sozinha e avisa).

## YouTube, passo a passo

1. Em console.cloud.google.com crie um projeto, ative *YouTube Data API v3* (e *YouTube Analytics API*).
2. Configure a tela de consentimento OAuth (tipo *Externo*), adicione você como usuário de teste e os escopos `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.force-ssl`, `https://www.googleapis.com/auth/yt-analytics.readonly`.
3. Crie um *ID do cliente OAuth* (Aplicativo da Web) com redirect `http://localhost:8765/callback`.
4. Rode `node fabrica/publicar/conectar.js youtube` e cole as linhas no `.env`.
5. Cota: cada upload custa 1600 unidades de 10 000/dia. Um vídeo por dia cabe folgado; se pedir mais cota, o Google exige verificação do projeto.
6. Thumbnail personalizada exige conta verificada por telefone; se falhar, a fábrica ignora (Shorts não mostram a capa de qualquer forma).

## Kwai

Não existe API pública de publicação. Padrão: **fila manual** (`fila_manual/kwai/<episódio>/` com `LEIA-ME.txt`, vídeo, capa e legenda prontos).
Modo `navegador`: `node fabrica/publicar/conectar.js kwai` abre um Chromium com perfil persistente em `~/.fabrica/kwai-perfil`; faça login uma vez. Depois, com `KWAI_MODO=navegador`, a fábrica tenta enviar pela página de upload (seletores em `fabrica/publicar/kwai_seletores.json`) e, se qualquer passo falhar, cai para a fila manual.
**Leia os Termos de Uso do Kwai antes**: automatizar a própria conta pode ser restrito e o risco é da conta. Nunca use isso com várias contas (cap. 51 e 84).

## Quando algo expira ou falha

| Sintoma | O que fazer |
|---|---|
| TikTok `access_token_invalid` / 401 | o refresh token venceu ou foi trocado: rode `conectar.js tiktok` de novo |
| Meta `(#190) Error validating access token` | token revogado (senha trocada, app removido, 2FA): refaça `conectar.js meta` |
| YouTube `invalid_grant` | refresh token expirado (app em Testing dura 7 dias) ou acesso revogado: `conectar.js youtube` |
| Instagram `Media ID is not available` / container `ERROR` | URL pública inacessível ou vídeo fora do padrão: confira `SUPABASE_URL`, bucket público e `docs/LIMITES_PLATAFORMAS.md` |
| TikTok publica privado | app sem auditoria (ou privacidade da conta); peça a revisão do app |
| `quotaExceeded` no YouTube | cota diária acabou; espera o dia virar (fuso do Pacífico) |

## Segredos no GitHub Actions

Repositório → *Settings → Secrets and variables → Actions* → *New repository secret*, um por variável da tabela. O fluxo diário lê todos como `env`.
`GITHUB_TOKEN` e `GITHUB_REPOSITORY` já existem lá; para usar `github_release` como hospedagem o fluxo precisa de `permissions: contents: write`.
