// base './' faz o jogo funcionar de qualquer pasta (e dentro do app Android/iOS com Capacitor)
// A cada build gera um numero de versao (version.json + embutido no index.html): quem abre uma pagina velha
// do cache descobre sozinho e recarrega (ver script "build" no index.html).
const BUILD = Date.now().toString(36);
const versao = () => ({
  name: 'versao-do-build',
  transformIndexHtml: (html) => html.replace('__BUILD__', BUILD),
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD }) }); },
});
export default {
  base: './',
  plugins: [versao()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
};
