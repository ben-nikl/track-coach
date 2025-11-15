// Typ kompatibilní s react-native-maps (LatLng)
export interface LatLng {
    latitude: number;
    longitude: number;
}

const R = 6371000; // poloměr Země v metrech

const deg2rad = (deg: number) => (deg * Math.PI) / 180;
const rad2deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Spočítá koncové body kolmé čáry (startovní/sektorové) přes dráhu.
 *
 * @param center       Bod na dráze, kde má být čára (střed čáry)
 * @param trackP1      Bod na dráze po směru (1)
 * @param trackP2      Bod na dráze po směru (2) – spolu s trackP1 definuje směr dráhy
 * @param halfWidthM   Půlka šířky čáry v metrech (např. 10 => čára cca 20 m široká)
 */
export function computePerpendicularSegment(
    center: LatLng,
    trackP1: LatLng,
    trackP2: LatLng,
    halfWidthM: number
): { start: LatLng; end: LatLng } {
    if (halfWidthM <= 0) {
        throw new Error("halfWidthM must be > 0");
    }

    // referenční bod = střed čáry
    const phi0 = deg2rad(center.latitude);
    const lambda0 = deg2rad(center.longitude);

    // pomocná funkce: převod lat/lon na lokální XY v metrech
    const projectToLocal = (p: LatLng) => {
        const phi = deg2rad(p.latitude);
        const lambda = deg2rad(p.longitude);

        const x = R * Math.cos(phi0) * (lambda - lambda0);
        const y = R * (phi - phi0);
        return { x, y };
    };

    const p1 = projectToLocal(trackP1);
    const p2 = projectToLocal(trackP2);

    // vektor směru dráhy
    const vx = p2.x - p1.x;
    const vy = p2.y - p1.y;

    const lenV = Math.hypot(vx, vy);
    if (lenV === 0) {
        throw new Error("trackP1 and trackP2 must not be the same point");
    }

    // kolmý vektor k dráze
    let nx = -vy;
    let ny = vx;

    const lenN = Math.hypot(nx, ny);
    if (lenN === 0) {
        throw new Error("Cannot compute perpendicular vector");
    }

    // jednotkový kolmý vektor
    const ux = nx / lenN;
    const uy = ny / lenN;

    // koncové body segmentu v lokálních souřadnicích
    const xA = halfWidthM * ux;
    const yA = halfWidthM * uy;
    const xB = -xA;
    const yB = -yA;

    // převod zpět na lat/lon
    const phiA = yA / R + phi0;
    const lambdaA = xA / (R * Math.cos(phi0)) + lambda0;

    const phiB = yB / R + phi0;
    const lambdaB = xB / (R * Math.cos(phi0)) + lambda0;

    const start: LatLng = {
        latitude: rad2deg(phiA),
        longitude: rad2deg(lambdaA),
    };

    const end: LatLng = {
        latitude: rad2deg(phiB),
        longitude: rad2deg(lambdaB),
    };

    return { start, end };
}
