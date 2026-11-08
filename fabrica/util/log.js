// Mensagens no terminal, em português, com hora. Sem dependências.
const cores = { cinza: "\x1b[90m", verde: "\x1b[32m", amarelo: "\x1b[33m", vermelho: "\x1b[31m", azul: "\x1b[36m", negrito: "\x1b[1m", fim: "\x1b[0m" };
const usarCor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (cor, s) => (usarCor ? `${cores[cor]}${s}${cores.fim}` : s);
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour12: false });

export const log = {
  passo: (titulo) => console.log(`\n${c("negrito", c("azul", "▶ " + titulo))} ${c("cinza", hora())}`),
  info: (...m) => console.log(c("cinza", "  ·"), ...m),
  ok: (...m) => console.log(c("verde", "  ✔"), ...m),
  aviso: (...m) => console.log(c("amarelo", "  ⚠"), ...m),
  erro: (...m) => console.error(c("vermelho", "  ✖"), ...m),
  tabela: (linhas) => console.table(linhas),
};
