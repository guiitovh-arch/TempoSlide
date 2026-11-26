// Grabación de voz liviana para ensayos: mono, limpieza de voz, Opus a 24 kbps (~180 KB/min).
// El micrófono se pide solo al activar la grabación y se libera siempre al terminar.
export const MAX_REC_MS = 60 * 60 * 1000;

export async function openMic() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador no permite grabar audio.');
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    throw new Error(e.name === 'NotFoundError'
      ? 'No encontramos ningún micrófono. Conecta uno o sigue ensayando sin audio.'
      : 'No diste permiso al micrófono. Para activarlo, pulsa el icono del candado (o de cámara) junto a la dirección del navegador, permite el micrófono para este sitio y vuelve a activar «Grabar audio». Puedes seguir ensayando sin audio.');
  }
}

export const closeMic = (stream) => stream?.getTracks().forEach((t) => t.stop());

export function createRecorder(stream) {
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 24000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' })); });
  return { rec, stopped };
}
