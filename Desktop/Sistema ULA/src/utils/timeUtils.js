/**
 * Utility function: Convierte un string de fecha/hora de 12h (con AM/PM, a. m./p. m.) o 24h
 * a un formato estricto de 24 horas compatible con SQL (YYYY-MM-DD HH:mm:ss o HH:mm:ss).
 * 
 * Reglas:
 * 1. Recibe el string o el estado del input (incluye horas, minutos y sufijo AM/PM o formato 24h).
 * 2. Detecta si contiene "a. m." / "p. m." / "am" / "pm".
 * 3. Reglas de conversión:
 *    - Si es PM y la hora es menor a 12, suma 12 (ej. "05" -> "17").
 *    - Si es AM y la hora es "12", se convierte a "00".
 *    - Mantiene minutos intactos y agrega ":00" para segundos si no los tiene.
 * 4. Retorna un string limpio en formato 24 horas compatible con SQL (ej. "17:52:00" o "YYYY-MM-DD 17:52:00").
 */
export const convertir12hA24h = (inputStr) => {
  if (!inputStr) return '';
  const str = String(inputStr).trim();

  let fechaPrefix = '';
  let timeStr = str;

  // Extraer fecha en formato YYYY-MM-DD si está presente al inicio
  const dateMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T\s]+(.*)$/);
  if (dateMatch) {
    fechaPrefix = dateMatch[1] + ' ';
    timeStr = dateMatch[2];
  }

  const lowerTime = timeStr.toLowerCase();
  const isPM = lowerTime.includes('p');
  const isAM = lowerTime.includes('a');

  const m = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    return str.replace('T', ' ');
  }

  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const seconds = m[3] ? parseInt(m[3], 10) : 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  return `${fechaPrefix}${hStr}:${mStr}:${sStr}`;
};
