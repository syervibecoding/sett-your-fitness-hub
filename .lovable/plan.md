

# Plano: BodyMap 3D Interativo com React Three Fiber

## Visão geral

Substituir o SVG atual por um modelo 3D de corpo humano construído com primitivas geométricas do Three.js (capsules, spheres, cylinders) posicionadas anatomicamente. O usuário poderá rotacionar o modelo arrastando, vendo frente e costas em um único viewport.

## Dependências

- `three@^0.160` — motor 3D
- `@react-three/fiber@^8.18` — binding React (v8 para React 18)
- `@react-three/drei@^9.122.0` — helpers (OrbitControls, RoundedBox, Capsule)

## Arquitetura

```text
BodyMap.tsx (mantém interface + lógica de cores)
└── BodyMap3D.tsx (novo componente)
    ├── <Canvas> com OrbitControls (rotação horizontal)
    ├── <HumanBody> — grupo de meshes por região muscular
    │   ├── Head (sphere, cor neutra fixa)
    │   ├── Chest (2x rounded capsules, cor dinâmica)
    │   ├── Shoulders (2x spheres)
    │   ├── Biceps / Triceps (capsules, posição braço)
    │   ├── Forearms (capsules menores)
    │   ├── Abs (stack de capsules achatadas)
    │   ├── Upper/Lower Back (capsules traseiras)
    │   ├── Glutes (2x spheres)
    │   ├── Quads / Hamstrings (capsules perna)
    │   └── Calves (capsules)
    └── Iluminação ambiente + direcional suave
```

## Detalhes

### Novo: `src/components/student/BodyMap3D.tsx`
- Componente `<Canvas>` com fundo transparente, câmera posicionada de frente
- `OrbitControls` limitado a rotação horizontal (azimuth livre, polar travado) para que o usuário gire e veja frente/costas
- Cada grupo muscular é um `<mesh>` com geometria Capsule/Sphere do drei
- Material `MeshStandardMaterial` com cor vinda do heatmap (mesma função `getHeatColor`)
- Emissão leve (emissive) nos músculos ativos para efeito de "brilho"
- Tooltip via `onPointerOver` mostrando nome do músculo + volume

### Alteração: `src/components/student/BodyMap.tsx`
- Importar `BodyMap3D` com lazy loading (`React.lazy` + `Suspense`)
- Substituir os dois SVGs pelo componente 3D único
- Manter legenda de calor e lista de volumes abaixo
- Fallback: skeleton loader enquanto carrega o Three.js

### Sem mudanças em outros arquivos
- `StudentDetail.tsx` e `WorkoutAnalysis.tsx` continuam passando `muscleVolumes` normalmente

## Resultado esperado
- Corpo humano 3D com formas anatômicas arredondadas (não blocos retangulares)
- Heatmap de cores por grupo muscular
- Rotação livre por arraste para ver frente/costas/lados
- Leve, sem modelo .glb externo — tudo construído com primitivas

