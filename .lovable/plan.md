# Avaliação por vídeo: corrigir cortes + marcadores

Dois ajustes no fluxo **Avaliação → Vídeo · manual** (`src/components/VideoAssessment.tsx`):
1. Corrigir os cortes de quadros que saem **pretos/cinza** ou geram **erro na tela**.
2. Adicionar um **editor de marcações** (linha reta, círculo/elipse, seta e ângulo) sobre cada quadro, com as marcações **gravadas na imagem** (aparecem no app e no laudo PDF).

---

## 1. Corrigir os cortes de frames

Hoje a captura faz `seek` no vídeo e desenha no canvas logo após o evento `seeked`. Em muitos codecs o quadro ainda não foi decodificado nesse instante → sai preto/cinza, e se o `seeked` nunca dispara a extração trava.

Melhorias na captura:
- **Garantir o vídeo pronto** antes de extrair: aguardar `loadedmetadata` + `canplay`, definir `video.muted = true` e `playsInline` (já existe) para permitir decodificação.
- **Esperar o quadro decodificado**: usar `video.requestVideoFrameCallback()` (quando disponível) após o `seek` para desenhar só quando houver frame real; fallback para `seeked` + pequeno atraso (`~120ms`).
- **Timeout no seek**: se `seeked`/callback não vier em ~3s, resolver mesmo assim e tentar o próximo ponto, em vez de travar.
- **Retry de quadro escuro** mais robusto: aumentar tentativas e o passo de avanço quando o brilho médio ficar abaixo do limite (quadros de transição/preto).
- **Tolerância a falha por quadro**: envolver cada corte em try/catch; se um falhar, seguir com os demais e sinalizar visualmente aquele quadro como "recapturar", sem derrubar todo o processo.
- **Mensagens de erro claras**: diferenciar "não foi possível ler a duração", "vídeo protegido/codec não suportado" e "alguns quadros ficaram escuros — use ± ou 'Usar vídeo' para recapturar".

O botão manual **Usar vídeo** / **±0,5s** já existente continua como recurso de ajuste fino.

## 2. Editor de marcações nos quadros

Novo componente `src/components/assessment/FrameAnnotator.tsx` — abre o quadro em tamanho grande com um canvas de sobreposição.

Ferramentas:
- **Linha reta** (ex.: linha de prumo/alinhamento)
- **Círculo/Elipse** (destacar articulação, ex.: valgo de joelho)
- **Seta** (direção do desvio)
- **Ângulo** (3 pontos → mostra o valor em graus sobre o desenho)

Interação:
- Seletor de ferramenta + cor (paleta da marca: Navy/Ink + vermelho para severa), espessura fixa.
- Desenho por arraste (linha/círculo/seta) e por 3 cliques (ângulo).
- **Desfazer** (última marca) e **Limpar tudo**.
- As marcações ficam guardadas como vetores por quadro (`annotations[]`), então dá para **reabrir e editar** depois; o quadro guarda também a imagem original.
- Ao **Aplicar**, o app compõe imagem original + marcações num novo JPEG e atualiza o quadro. Um selo "marcado" aparece no card.

Como as marcações são gravadas no `dataUrl` do quadro, elas fluem automaticamente para:
- o **upload** em `assessment-frames` (imagem salva já marcada);
- o **laudo PDF** (`src/lib/assessment/pdf.ts` já embute `dataUrl` de cada vista — nenhuma mudança necessária lá).

No card de cada quadro (`VideoAssessment.tsx`) entra um botão **Marcar** que abre o `FrameAnnotator`.

---

## Detalhes técnicos

- **Arquivos alterados**
  - `src/components/VideoAssessment.tsx`: captura mais robusta (`requestVideoFrameCallback`, timeout, retry, try/catch por quadro), estado extra por frame (`originalDataUrl`, `annotations`), botão **Marcar** e integração com o annotator.
  - **Novo** `src/components/assessment/FrameAnnotator.tsx`: canvas de anotação com as 4 ferramentas, undo/limpar e composição final em JPEG.
- **Sem mudança de banco**: `assessment_frames` continua guardando o JPEG (agora já marcado) em `image_url`; o vetor de marcações pode ir dentro de `trainer_findings`/`assessment_json` para permitir reedição futura (opcional, sem migração).
- **Sem IA**: tudo roda no navegador, coerente com o fluxo manual atual. O vídeo continua **não** sendo armazenado.

## Fora de escopo
- Anotar diretamente sobre o vídeo em reprodução (marcação é feita sobre os quadros extraídos).
- Reconhecimento automático de pose/ângulos por IA.
