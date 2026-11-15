const berlin = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
});
/** ms UTC -> YYYY-MM-DD in Europe/Berlin */
export const berlinDate = (ms: number): string => berlin.format(new Date(ms));
