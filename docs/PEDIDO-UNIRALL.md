# Pedido ao Unirall: o que ele já faz pelo jogo e o que falta

Escrito para o agente que cuida do Unirall. O jogo é o "Anime Crossover RPG" (Three.js, web/celular, pasta `Jogo novo`).
Data do levantamento: 2026-11-08. Tudo abaixo foi testado de verdade nesta máquina (placa RTX 5060 Ti 16 GB livre).

## 1. O que o Unirall já faz e eu usei (funciona bem)
- `imagegen/server.py` (SDXL base 1.0, `POST /generate`): imagem 768x768 em ~6 s (a primeira leva ~50 s, carrega o modelo).
  Com isso gerei **30 imagens** para o jogo: 16 retratos de criaturas, 7 retratos de classes, 6 paisagens de reinos e 1 arte de abertura
  (em `public/img/`). A qualidade para arte 2D/ícone/retrato é boa. O script está em `tools/gen-assets.py`.
- Existem também (não usei ainda): `klein_edit.py` (edição de imagem), `forma3d.py` (Hunyuan3D: imagem -> malha), `tools/blender`,
  `pipeline3d/*` (pintar e animar malha), Real-ESRGAN, SeedVR2, RIFE, LTX.

Problemas que apareceram no teste (úteis para quem mexe no Unirall):
- Sem **seed** exposta: não dá para repetir uma imagem boa nem gerar variações controladas.
- O modelo base é "geral", não "anime": por vezes sai estilo misturado. O prompt "slime" saiu uma menina de coroa; precisei reescrever o prompt.
- Fundo nunca é transparente; precisei usar o fundo pastel como moldura.
- Uma imagem por chamada, sem fila nem progresso, sem lote.

## 2. O que falta, em ordem de valor para o jogo

### A. Lote + semente (pequeno, muito útil)
`POST /batch` recebendo uma lista de `{id, prompt, negative, width, height, steps, seed, variantes}` e gravando `out_dir/<id>_<seed>.png`
com um `manifest.json` (id, seed, caminho, tempo). Opção `variantes: 4` para eu escolher a melhor.
Hoje preciso de um script externo (`tools/gen-assets.py`) fazendo um pedido por vez.

### B. Estilo anime consistente
- Aceitar um checkpoint/LoRA de anime/chibi (por exemplo, variantes SDXL de anime) além do SDXL base, escolhido por pedido (`"modelo":"anime"`).
- Predefinições de estilo com nome (`icone-criatura`, `retrato-classe`, `paisagem`, `textura`) que montam prefixo de prompt e negativo corretos.

### C. Personagem consistente (o mesmo herói em várias imagens)
Gerar o MESMO personagem em vista de frente, de lado e de costas, e em várias expressões (calmo, alegre, bravo, sono),
a partir de uma imagem de referência (IP-Adapter ou FLUX Kontext, que o Unirall já tem em `klein_edit.py`). Isso serve para:
1. folhas de rosto/olhos para o jogo (decalque no rosto 3D);
2. turnaround (frente/lado/costas) para modelagem.

### D. Fundo transparente e texturas
- Remover o fundo (BiRefNet/rembg) e salvar PNG/WebP com transparência: ícones de itens, criaturas, sprites.
- Gerar **textura repetível** (sem emenda) para chão/paredes dos 6 reinos (areia, cemitério, cristal, deserto, floresta, vazio) em 512x512.

### E. Exportador de pacote de assets para jogo
Depois de gerar: redimensionar, converter para WebP, empacotar em atlas e escrever `manifest.json` com nomes estáveis.
Pasta de saída configurável (hoje o jogo copia à mão para `public/img/`).

### F. Imagem -> personagem 3D jogável (o maior ganho de beleza, e o mais difícil)
Hoje o herói do jogo usa o esqueleto do pacote KayKit (ossos: hips, spine, chest, upperarm.l/r, lowerarm.l/r, hand.l/r, upperleg.l/r, lowerleg.l/r, foot.l/r, toes.l/r, head)
e o corpo/cabeça é montado por código (`src/looks.js`), com cara de "boneco simples". Para ficar realmente bonito:
1. Hunyuan3D (já existe em `forma3d.py`) gerar a malha a partir da arte do personagem.
2. Reduzir para 4–8 mil triângulos (decimate no Blender, que já está no Unirall) e "assar" a textura em 1024x1024.
3. **Rig automático** no esqueleto acima (ou outro humanoide padrão) e **reaproveitar as animações** do KayKit (idle, correr, ataque, magia, morte) por retarget.
4. Exportar **GLB** com a cabeça e o cabelo como peças separadas (`Head`, `Hair_<estilo>`) para o jogo poder trocar cor/penteado.
5. Rodar em lote: uma pasta de artes -> uma pasta de GLB prontos, com relatório de falhas.
Se isso for pesado demais, a alternativa 2D é: sprite 2D do personagem em 8 direções (idle + andar) gerado por imagem, e o jogo usa billboard.

### G. Uso por agente, sem tela
Modo sem interface (linha de comando ou HTTP) com: `unirall gen --jobs jobs.json --out pasta`, fila, `GET /progress`, cancelar, e código de saída diferente de zero em erro.
Hoje o servidor só carrega o modelo no primeiro pedido e descarrega depois de 120 s parado: ótimo, manter, mas expor `/health` com o que está carregado.

## 3. O que eu ainda gostaria de pedir como imagem (lista de entrega)
- Retratos de cada personagem pronto (8) em 3 expressões.
- Ícones de itens: 7 armas por classe x 6 níveis (ou um gerador de ícone por nome), 6 peças de armadura, gemas, poções.
- Ícones de habilidades (7 classes x ~6 habilidades) com moldura única.
- Texturas repetíveis dos 6 reinos e céus (skybox) de cada reino.
- Monstros por reino (hoje todos são esqueletos pintados de cor): arte de caranguejo, fantasma, golem de cristal, cacto, cogumelo, estilhaço do vazio.

## 4. Como o jogo usa o que vier
Tudo entra por `public/img/...` (WebP) e, se houver GLB, por `public/models/...`. Os nomes dos arquivos podem ser os do `manifest.json`;
é só me passar a pasta e o manifesto. Os assets precisam ter licença livre para uso comercial (as imagens do SDXL local são geradas por nós).
