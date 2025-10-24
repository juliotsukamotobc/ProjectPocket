# Project Pocket
Detecção de movimento multiplataforma (web first) com MediaPipe Pose Landmarker. Pronto para rodar como site estático e fácil de empacotar com Capacitor.

## 📦 Estrutura
```
project-pocket/
├─ index.html
├─ styles.css
├─ src/
│  ├─ main.js
│  ├─ pose.js
│  ├─ smoothing.js
│  └─ ui.js
├─ assets/
│  └─ (coloque aqui ícones e exemplos)
├─ .gitignore
└─ README.md
```

## ▶️ Rodar localmente (sem Node)
Abra o `index.html` com um servidor local (por restrições do browser à câmera).
Exemplos:
- Python 3: `python -m http.server 5500` e acesse http://localhost:5500
- VS Code: extensão *Live Server*

> Dica: no Chrome, garanta que o site está servindo via http://localhost ou https para liberar a câmera.

## 🧰 Rodar localmente (com Node opcional)
Se quiser um servidor estático simples:
```
npx http-server -p 5500
```
e acesse http://localhost:5500

## ⏺ Fluxo básico
1) Clique **Start Camera** para habilitar a câmera.
2) Selecione **Instructor** e grave um movimento (botão **Record**). Ao finalizar, salve o JSON.
3) Selecione **Student** e **Load Instructor JSON** para comparar em tempo real enquanto executa o movimento.
4) Ajuste o **Smoothing** (média móvel) e o **Display** (linhas/cores) no painel.

## 🧮 Como funciona
- Usa **MediaPipe Tasks - Pose Landmarker** (via CDN) para inferir 33 pontos do corpo.
- Aplica uma **média móvel** simples para suavizar jitter.
- Calcula diferenças angulares entre segmentos (ombro‑cotovelo‑punho, quadril‑joelho‑tornozelo, etc.).
- Permite exportar/importar JSON do movimento do instrutor.

## 🚀 Publicar no GitHub
1. Crie o repositório no GitHub (ex.: `project-pocket`).
2. No terminal, dentro da pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Project Pocket"
   git branch -M main
   git remote add origin https://github.com/<seu-usuario>/project-pocket.git
   git push -u origin main
   ```
3. Antes do primeiro deploy, habilite o GitHub Pages manualmente em **Settings → Pages** e selecione **GitHub Actions** em **Build and deployment**.
   - Em **Settings → Actions → General**, ajuste **Workflow permissions** para **Read and write**.
   - Com essas permissões configuradas, o fluxo `Deploy static site to GitHub Pages` publica o site a cada push na branch `main`.

## 📱 Empacotar com Capacitor (opcional)
1) Inicialize Node (opcional, apenas se for usar Capacitor):
   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli
   npx cap init "Project Pocket" "com.example.projectpocket"
   ```
2) Configure `capacitor.config.ts` para apontar `webDir` para a raiz ou `www` (se você copiar arquivos pra lá).
3) Adicione plataformas:
   ```bash
   npx cap add android
   npx cap add ios
   ```
4) Sincronize e abra os projetos nativos:
   ```bash
   npx cap sync
   npx cap open android
   npx cap open ios
   ```

## 📄 Licença
MIT – use, modifique e contribua.
