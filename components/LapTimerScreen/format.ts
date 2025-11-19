export function formatLapTime(ms: number): string {
    if (ms == null || isNaN(ms)) return '--:--.---';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millis = Math.floor(ms % 1000);
    const m = minutes.toString().padStart(1, '0');
    const s = seconds.toString().padStart(2, '0');
    const mmm = millis.toString().padStart(3, '0');
    // Vždy zobrazit formát M:SS.mmm pro konzistenci
    return `${m}:${s}.${mmm}`;
}

export function formatDelta(ms?: number): string {
    if (ms == null || isNaN(ms)) return '';
    const sign = ms > 0 ? '+' : '';
    const abs = Math.abs(ms);
    return `${sign}${(abs / 1000).toFixed(3)}`;
}
