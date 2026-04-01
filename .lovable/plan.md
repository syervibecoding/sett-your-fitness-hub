

# Plano: Melhorar BodyMap 3D — Corpo Humano Realista

## Problema atual
As peças estão soltas no espaço, sem conexão entre si. Não existe um "corpo base" que una tudo — são apenas cápsulas e esferas flutuando, impossível reconhecer como humano.

## Solução
Reescrever `BodyMap3D.tsx` com uma abordagem em **duas camadas**:

1. **Camada base (silhueta)** — um corpo completo em cor neutra escura formado por primitivas sobrepostas e encaixadas (torso cilíndrico, pelve, braços, pernas, pescoço). Isso cria a **forma humana reconhecível**.

2. **Camada muscular (heatmap)** — grupos musculares coloridos posicionados **sobre** o corpo base com leve offset para frente/trás, ligeiramente maiores para "destacar" do corpo.

### Mudanças específicas no arquivo `BodyMap3D.tsx`

**Corpo base (nova):**
- Torso: capsule grande vertical (raio ~0.14, altura ~0.5) — forma o tronco inteiro
- Pelve: sphere achatada (scale Y 0.6) conectando tronco às pernas
- Braços superiores: 2x capsules conectadas aos ombros, anguladas ~5° para fora
- Antebraços: 2x capsules menores continuando os braços
- Coxas: 2x capsules grossas saindo da pelve
- Canelas: 2x capsules finas continuando as coxas
- Pescoço: capsule fina entre cabeça e torso
- Tudo em cor neutra `hsl(220 10% 15%)` sem hover/interação

**Camada muscular (ajustes):**
- Reposicionar todas as peças para ficarem encostadas/sobrepostas ao corpo base
- Aumentar segmentos das geometrias (de 8/16 para 12/24) para ficarem mais suaves
- Peitorais: posição Z +0.08 (mais para frente, sobre o torso)
- Dorsais: posição Z -0.08 (mais para trás)
- Quadríceps/posterior: encostados nas coxas base
- Ombros: spheres maiores (raio 0.11) encaixadas na junção braço-torso

**Câmera e iluminação:**
- Câmera mais próxima: `position: [0, 1.1, 2.8]`, `fov: 38`
- Adicionar `pointLight` suave de baixo para iluminar pernas
- Target do OrbitControls no centro do corpo `[0, 1.1, 0]`

**Altura do container:** Aumentar de 320px para 380px para dar mais espaço

### Resultado
Silhueta humana sólida e reconhecível com músculos coloridos destacados sobre ela — muito mais próximo de um manequim anatômico.

