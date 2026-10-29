# Fogo e Gelo

Jogo de ritmo em VR para o Meta Quest 3 (roda no navegador do óculos, WebXR), também joga no PC
com o mouse. Você está numa ponte de pedra sobre um abismo, entre um vulcão (esquerda) e uma
geleira (direita). Cada lâmina é de **fogo** (laranja) ou de **gelo** (azul) e o **gatilho troca
o elemento daquela lâmina**. As esferas vêm de frente pela ponte: esfera de fogo só quebra com
lâmina de gelo, esfera de gelo só com lâmina de fogo. 3 músicas de rock épico compostas pelo
próprio jogo, cada uma em Fácil / Normal / Difícil.

É um dos 5 jogos de ritmo com lâminas (ForroFrutasVR, FogoGeloVR, PincelVentoVR, CinturaoVR,
RedemoinhoVR). Cada um tem a própria cópia do núcleo; não há dependência entre as pastas.

## Como rodar / jogar

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8792`. O mouse move a lâmina
(uma só, começa de gelo); **botão direito ou Espaço troca o elemento**, e a dica no canto mostra
o elemento atual. Esc pausa, F mostra FPS.

**No Quest:** abrir **https://parappathe.github.io/FogoGeloVR/** no navegador do óculos e
apertar "Entrar em VR". Nos menus o gatilho aponta e clica; durante a música o **gatilho troca o
elemento da lâmina daquela mão**. B ou Y pausa. Para atualizar o site: commitar e rodar
`python publicar.py FogoGeloVR` em `C:\claude code`.
Alternativa sem publicar: `jogar-no-quest.bat` (HTTPS na rede de casa; ver o PingPongVR).

### Regras

- Começa com a lâmina esquerda de fogo e a direita de gelo. Cada aperto do gatilho troca
  (fogo ⇄ gelo), com som, brilho e vibração.
- Esfera de fogo (bola de lava com labaredas) quebra com lâmina de **gelo**; esfera de gelo
  (cristal com pontas) quebra com lâmina de **fogo**. Lâmina do mesmo elemento = erro.
- **Não há mão certa**: qualquer mão serve, o que importa é o elemento da lâmina. As esferas de
  fogo chegam vindo do lado do vulcão e as de gelo do lado da geleira, mas param na faixa delas.
- Seta na esfera: sentido do corte (tolerância de ~65°). Anelzinho: qualquer sentido. No Fácil
  todas são de sentido livre.
- **Vapor** (uma esfera de fogo e uma de gelo grudadas, com um anel branco), só no Normal e no
  Difícil: tem que passar as duas lâminas, uma de fogo e uma de gelo, com até 0,15 s de
  diferença, em qualquer sentido. Duas lâminas do mesmo elemento ou a segunda atrasada = erro.
  **No PC** (uma lâmina só) o vapor quebra com um corte de qualquer elemento.
- O mapa obriga a trocar: a mesma mão recebe esferas de elementos alternados, sempre com tempo
  para apertar o gatilho entre elas (mínimo 0,5 s no Fácil, 0,4 s no Normal, 0,3 s no Difícil).
- Corte vale se a lâmina passa rápido o bastante (1,1 m/s). Pontos por corte até 100
  (velocidade, sentido e centro). Multiplicador x2/x3/x4 com 8/16/32 em sequência; errar zera.
- Barra verde (vida): erro gasta, acerto recupera. Zerou, perdeu (opção "Sem derrota").
- Recordes e opções ficam no navegador (localStorage `fogogelovr.v1`).

### Músicas

| Música | Estilo | Notas Fácil / Normal / Difícil |
|---|---|---|
| Brasa | 100 BPM, mi menor, ~106 s | 63 / 103 / 181 |
| Degelo | 125 BPM, ré frígio, ~100 s | 79 / 122 / 229 |
| Erupção | 150 BPM, mi menor harmônica, ~90 s | 88 / 142 / 280 |

## Como testar

- `node tests/run.js` (ou `npm test`): composição (sempre igual, duração, tem guitarra e
  viradas), mapas de todas as músicas e dificuldades (ordem, intervalo por mão, posições,
  elementos válidos, Fácil sem seta e sem vapor, vapor sozinho), robô que troca o elemento antes
  de cada nota e corta tudo (tem que acertar 100%), troca sempre com tempo para o gatilho, o mapa
  obriga a trocar (sequências alternadas na mesma mão); cortes inválidos: lâmina do mesmo
  elemento, sentido oposto, lâmina devagar, corte atrasado; lâmina da "outra mão" com o elemento
  certo vale; vapor com elementos iguais ou cortes separados não quebra; placar. Tem que terminar
  com "Tudo certo". Sem som.
- No navegador (console): `jogo.dev.autoplay = true; jogo.startSong(0, 2); jogo.dev.advance(120)`
  joga a música inteira na hora com o robô (o painel escondido não anima, por isso o `advance`).
  O robô aperta o "gatilho" sozinho. `jogo.dev.freeze = true` congela a cena para tirar foto.
  Nenhum desses destrava o som.
- **Só dá para testar no óculos:** ângulo da lâmina na mão (opção de -30° a +30°), se dá tempo
  de apertar o gatilho entre as notas no Difícil, sensação do corte, o vapor com as duas mãos,
  dificuldade real, FPS (meta 72).

## Estrutura

| Arquivo | O que tem |
|---|---|
| `js/music.js` | Compositor: partitura → eventos em batidas (bateria por padrões, baixo, guitarra com acordes de força, coral, melodia gerada com semente). Sem navegador |
| `js/songs.js` | As 3 músicas: andamento, tom, escala, acordes, seções (energia, partes), timbres e tambores de rock |
| `js/chart.js` | Gerador do mapa de notas: posições, setas, elemento de cada esfera, trocas e vapor (dificuldades em `DIFFS`). Sem navegador |
| `js/judge.js` | Colisão lâmina × esfera (área varrida entre quadros), elemento, sentido/força do corte, regra do vapor, placar e vida, robô. Sem navegador |
| `js/mode.js` | Regra própria do Fogo e Gelo: caminho das esferas pela ponte (de frente, saindo do lado do elemento). Sem navegador |
| `js/synth.js` | Sintetizador Web Audio (instrumentos por preset, distorção de guitarra), tocador com relógio do áudio, efeitos sonoros (troca de elemento, corte de fogo/gelo/vapor) |
| `js/scene.js` | Cenário (ponte, vulcão, lava, geleira, cristais, brasas, neve), esferas, lâmina que muda de elemento, rastro, partículas |
| `js/ui.js` | Painel de menu 3D (canvas) e cores do tema |
| `js/main.js` | Liga tudo: VR, controles (gatilho troca o elemento), mouse, menus, laço do jogo, robô do PC, `window.jogo` |
| `js/save.js` | Recordes e opções |
| `tests/run.js` | Testes automáticos |
| `serve.py`, `jogar-no-quest.bat` | Servidor local sem cache (porta 8792; `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros, jogador em (0, 0, 0) virado para -Z (fundo da ponte); as esferas aparecem a
22 m e chegam no ponto de corte a 0,9 m à frente (`HIT_DIST`, a linha laranja e azul no chão),
na altura delas (0,85 a 1,45 m + ajuste de altura). No VR o `rig` é recentralizado ao entrar e
pelo menu de pausa.

## Regras e convenções do projeto

- `music.js`, `chart.js`, `judge.js`, `mode.js` e `songs.js` não usam navegador nem Three.js
  (rodam nos testes do Node).
- Elementos são números: 0 = fogo, 1 = gelo (2 = vapor, só nas esferas). A esfera quebra com a
  lâmina do elemento oposto.
- Música nova: só dados em `songs.js`. Rodar os testes (o robô tem que acertar tudo).
- Ajuste de dificuldade: `DIFFS` em `chart.js` (`keep` = densidade, `speed` = velocidade das
  esferas, `minHand` = intervalo mínimo da mesma mão, `swap` = chance de pedir troca de
  elemento, `minSwap` = tempo mínimo para o gatilho entre duas notas da mesma mão com elementos
  diferentes, `vapor` = chance de vapor).
- Testes nunca tocam som (o áudio só é liberado por clique de verdade).

## Decisões

- Música composta pelo jogo (sintetizador) em vez de arquivos: sem direito autoral (site
  público), sincronia exata (o mapa sai da mesma partitura), nada para baixar.
- Visual e regras próprios, sem copiar o Beat Saber: esferas elementais em vez de blocos, a cor
  é da lâmina (muda no gatilho), não da mão.
- O mapa diz qual mão "naturalmente" pega cada esfera (lado esquerdo/direito), só para o robô e
  para os testes calcularem as trocas; o juiz aceita qualquer lâmina com o elemento certo.
- Vapor: as duas lâminas com elementos diferentes em até 0,15 s, sentido livre, sempre sozinho
  no tempo dele. Se o mapa chega no vapor com as duas lâminas no mesmo elemento, ele pede a troca
  de uma delas (com o tempo mínimo de gatilho).
- No PC uma lâmina só (começa de gelo), que troca com botão direito ou Espaço; o vapor quebra
  com um corte. O robô do navegador usa as duas lâminas e cada uma só olha as notas do seu lado
  (para não esbarrar nas da outra mão).
- As esferas vêm de frente (não 360°): o desafio é a troca de elemento, não girar.

## Pendências / problemas conhecidos

- Nada testado no Quest ainda: ângulo da lâmina na mão (espaço "grip" do WebXR, lâmina para -Z),
  se o gatilho no meio do corte atrapalha, sincronia do som no óculos (usa `outputLatency`), FPS.
- No PC, com uma lâmina só, notas seguidas das duas mãos podem pedir elementos diferentes com
  menos de 0,3 s entre elas (o tempo mínimo é garantido por mão, não entre mãos); no Difícil o
  PC fica bem mais difícil que no VR.
- O som (guitarra distorcida, coral) só foi verificado por código; ninguém ouviu ainda.
