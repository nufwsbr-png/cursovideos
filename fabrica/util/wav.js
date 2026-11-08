// Monta um arquivo WAV (PCM 16 bit) a partir de amostras brutas.
export function pcm16ParaWav(pcm, taxa = 24000, canais = 1) {
  const cabecalho = Buffer.alloc(44);
  const bytesPorAmostra = 2;
  const tamanhoDados = pcm.length;
  cabecalho.write("RIFF", 0);
  cabecalho.writeUInt32LE(36 + tamanhoDados, 4);
  cabecalho.write("WAVE", 8);
  cabecalho.write("fmt ", 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(canais, 22);
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * canais * bytesPorAmostra, 28);
  cabecalho.writeUInt16LE(canais * bytesPorAmostra, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36);
  cabecalho.writeUInt32LE(tamanhoDados, 40);
  return Buffer.concat([cabecalho, pcm]);
}
